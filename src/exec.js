// @ts-self-types="./exec.d.ts"

// Sync-when-possible, value-or-promise executor. Threads a value through a
// function-list, emitting terminal values via a `push` callback. Unlike
// `fun()`'s collect sink (whose return is ignored) the push return is HONORED: when
// push returns a Promise — a downstream backpressure signal — the executor
// suspends AT that push and chains the remainder, preserving a bounded queue.
// Returns undefined when the whole traversal ran synchronously, or a Promise
// when it had to suspend.
//
// Duck-types returned values the way the original 1.x `fun()` did: thenable →
// chain; many() → expand; .next → iterate as a generator; none/null → drop;
// stop → throw Stop; finalValue → emit and short-circuit. An async generator is
// not special — it's a generator whose next() returned a promise, handled by
// the same suspend/resume path. A sync generator stays synchronous.
//
// This is the engine `asStream` / `asWebStream` will adopt in place of their
// `async function applyFns` (see
// [[projects/stream-chain/design/sync-when-possible-executor]]); kept here as a
// standalone module so it can be unit-tested in isolation.

import * as defs from './defs.js';

// On a push function: the value to throw once its owner is torn down.
const cancelSymbol = Symbol('cancel');

// On a Stop: the index of the first stage after the one that stopped. Set at every
// stage call it leaves, so an index from an inner pipeline (a `pipe()` stage) is
// replaced by the outer one.
const stopAtSymbol = Symbol('stopAt');

const markStop = (error, index) => {
  if (error instanceof defs.Stop) error[stopAtSymbol] = index;
  throw error;
};

// Where the flush after a stop starts; a Stop with no index (an adapter's single
// function) leaves no stage after the stopper to flush.
const stopIndex = (stop, fns) => stop[stopAtSymbol] ?? fns.length;

// The error an abnormal exit surfaces when a cleanup also fails (a generator's
// `finally`, fired by `it.return()`, or a stage's `abort`): the cleanup error alone
// when there was no error or only a `stop`, a clean end; both, when the original is a
// real Error; a non-Error control sentinel (gen()'s CANCEL) keeps its identity, since
// callers compare against it. One home for nextGen's abort and the owners' releases.
const withCleanupError = (err, cleanupErr) => {
  if (err == null || err instanceof defs.Stop) return cleanupErr;
  return err instanceof Error
    ? new AggregateError([err, cleanupErr], 'pipeline error; generator cleanup also failed')
    : err;
};

// Checked once at build time, so a pipeline without an `abort` pays nothing at teardown.
const hasAborters = fns => fns.some(fn => fn[defs.abortSymbol]);

// Each flushable stage gets its `final` or its `abort`, at most once: an owner keeps
// one `finished` set per pipeline, holding the stages whose `final` completed or whose
// `abort` was called. A stage whose `final` threw, or is still running, can be aborted.
const noteFinal = (value, fn, finished) => {
  if (value && typeof value.then == 'function') return value.then(v => (finished.add(fn), v));
  finished.add(fn);
  return value;
};

// Releases resource-owning stages among fns[0..to) on abnormal termination, in order,
// skipping those in `finished`; resolves to the failure to surface, or undefined.
const abortStages = async (fns, finished, to = fns.length) => {
  let failure;
  for (let i = 0; i < to; ++i) {
    const fn = fns[i],
      abort = fn[defs.abortSymbol];
    if (!abort || finished.has(fn)) continue;
    finished.add(fn);
    try {
      await abort();
    } catch (error) {
      failure =
        failure === undefined
          ? error
          : new AggregateError([failure, error], 'stage cleanup failed more than once');
    }
  }
  return failure;
};

const next = (value, fns, index, push) => {
  for (let i = index; ;) {
    if (value && typeof value.then == 'function') {
      const ii = i;
      return value.then(
        v => next(v, fns, ii, push),
        e => markStop(e, ii)
      );
    }
    if (value == null || value === defs.none) return;
    if (value === defs.stop) markStop(new defs.Stop(), i);
    if (defs.isFinalValue(value)) {
      return push(defs.getFinalValue(value)); // emit, bypass remaining fns
    }
    if (defs.isMany(value)) {
      return nextMany(defs.getManyValues(value), fns, i, push);
    }
    if (value && typeof value.next == 'function') {
      return nextGen(value, fns, i, push);
    }
    if (i >= fns.length) {
      return push(value); // terminal plain value
    }
    try {
      value = fns[i++](value);
    } catch (error) {
      markStop(error, i);
    }
  }
};

// Iterate a many() array, threading each element. A resumable `step` stays
// synchronous until one element returns a promise (a backpressure push, or
// genuine async); then it suspends AT that element and resumes the remainder
// via .then(step). Allocating one closure per actual suspension — not one per
// element — keeps live allocation O(1) in the array length even when the
// consumer backpressures from element 0 (the bug a per-element .then chain hit:
// a chunk-sized many() exploded into O(N) live promises). Mirrors nextGen.
const nextMany = (values, fns, i, push) => {
  const step = j => {
    for (; j < values.length; ++j) {
      const r = next(values[j], fns, i, push);
      if (r && typeof r.then == 'function') {
        const jj = j;
        return r.then(() => step(jj + 1));
      }
    }
  };
  return step(0);
};

// Iterate a generator, threading each yield. A resumable `step` keeps a sync
// generator with a draining queue fully synchronous; it goes async only when
// next() returns a promise (async generator) or a yield's push backpressures —
// then resumes via .then(step).
const nextGen = (it, fns, i, push) => {
  const step = () => {
    for (;;) {
      // a torn-down owner marks its push: a generator whose values all get dropped
      // never reaches the push, so it is stopped here, before its next yield
      if (push[cancelSymbol]) throw push[cancelSymbol];
      let data;
      try {
        data = it.next();
      } catch (error) {
        markStop(error, i);
      }
      if (data && typeof data.then == 'function') {
        return data.then(
          d => {
            if (d.done) return;
            const r = next(d.value, fns, i, push);
            return r && typeof r.then == 'function' ? r.then(step) : step();
          },
          e => markStop(e, i)
        );
      }
      if (data.done) return;
      const r = next(data.value, fns, i, push);
      if (r && typeof r.then == 'function') return r.then(step);
    }
  };
  // Abnormal termination — a downstream stage threw (sync or rejected promise),
  // or a push rejected (the gen bridge's consumer CANCEL) — leaves the source
  // generator suspended at a yield, so its `finally {}` never runs and a
  // resource-owning source (e.g. asyncBlockReader's FileHandle) leaks. Run
  // `it.return()` to fire that finally, awaiting it for an async generator, then
  // re-throw the ORIGINAL error. Normal completion (`data.done`) already ran the
  // generator's own finally — don't touch it. The sync fast path stays
  // overhead-free: a plain `try` plus one `.then(undefined, abort)` only when
  // iteration actually suspended.
  const abort = err => {
    const onCleanupError = cleanupErr => withCleanupError(err, cleanupErr);
    let ret;
    try {
      ret = it.return ? it.return() : undefined;
    } catch (cleanupErr) {
      throw onCleanupError(cleanupErr);
    }
    if (ret && typeof ret.then == 'function') {
      return ret.then(
        () => {
          throw err;
        },
        cleanupErr => {
          throw onCleanupError(cleanupErr);
        }
      );
    }
    throw err;
  };
  let r;
  try {
    r = step();
  } catch (err) {
    return abort(err);
  }
  return r && typeof r.then == 'function' ? r.then(undefined, abort) : r;
};

// Flush flushable stages (called when the factory's driver receives `none`).
// Each flushable's output threads through the stages after it, value-or-promise
// chained. Resumable `step` (same shape as nextMany) keeps live allocation O(1) in
// the number of flushable stages under backpressure. A stop during the flush is a
// clean end for the stages after the stopper: the flush resumes there, and the last
// stop is rethrown at the end. A stopper never precedes the flushable being drained,
// so each resume starts further on. An owner's `finished` set skips the stages already
// released or flushed, and records each `final` that completes.
const flush = (fns, index, push, finished) => {
  let stop = null;
  const resume = error => {
    if (!(error instanceof defs.Stop)) throw error;
    stop = error;
    return step(stopIndex(error, fns));
  };
  const step = i => {
    for (; i < fns.length; ++i) {
      const f = fns[i];
      if (!defs.isFlushable(f) || finished?.has(f)) continue;
      let r;
      try {
        let value;
        try {
          value = f(defs.none);
        } catch (error) {
          markStop(error, i + 1);
        }
        if (finished) value = noteFinal(value, f, finished);
        r = next(value, fns, i + 1, push);
      } catch (error) {
        return resume(error);
      }
      if (r && typeof r.then == 'function') {
        const ii = i;
        return r.then(() => step(ii + 1), resume);
      }
    }
    if (stop) throw stop;
  };
  return step(index);
};

// After a stop, the stopper and the stages before it are released, never flushed. A
// failing release ends the pipeline instead, and nothing will flush the stages after
// the stopper, so they are released too. Resolves to the failure, or undefined.
const releaseStopped = async (fns, finished, stop) => {
  const failure = await abortStages(fns, finished, stopIndex(stop, fns));
  if (failure === undefined) return undefined;
  const more = await abortStages(fns, finished);
  return more === undefined
    ? failure
    : new AggregateError([failure, more], 'stage cleanup failed more than once');
};

// A stop is a clean end for the stages after the one that stopped: they are flushed,
// then the rest released. For a driver that flushes on its own (asStream, asWebStream),
// after a stop from its data pass or from its own flush, whose stages are then
// finished. A failing flush releases every stage not finished yet.
const finishStop = async (fns, stop, push, finished) => {
  let error;
  try {
    await flush(fns, stopIndex(stop, fns), push, finished);
  } catch (e) {
    if (e instanceof defs.Stop) stop = e;
    else error = e;
  }
  const failure =
    error === undefined
      ? await releaseStopped(fns, finished, stop)
      : await abortStages(fns, finished);
  if (failure !== undefined) error = withCleanupError(error, failure);
  if (error !== undefined) throw error;
};

// gen()'s push→pull bridge over the executor (next / flush); with `once`, pipe()'s
// one-shot driver: a call drives one value, then the flush.
const genBridge = (fns, once) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  const canAbort = hasAborters(fns),
    finished = new Set(); // see exec.js noteFinal
  let flushed = false,
    stopAt = 0; // after a stop, the flush starts at the stage after the stopper

  // `once`: one value, then the flush, in finishStop's order, as asStream and
  // asWebStream do: after a stop, the stages after the stopper are flushed before the
  // stopper and the stages before it are released
  const drive = async (value, push) => {
    try {
      await next(value, fns, 0, push);
    } catch (error) {
      if (!(error instanceof defs.Stop)) throw error;
      await finishStop(fns, error, push, finished);
      throw error;
    }
    await flush(fns, 0, push, finished);
  };

  // push→pull bridge: the shared executor drives the producer (exec.next, or
  // exec.flush on `none`); each push parks on a promise the consumer resolves
  // when it pulls the next value, so production stays one item ahead (bounded).
  // A for-await `break` runs .return() → the finally rejects the parked push
  // with CANCEL, unwinding exec; the driver swallows it (no leaked producer).
  let g = async function* (value) {
    if (flushed) throw Error('Call to a flushed pipe.');
    const isFlush = !once && value === defs.none;
    if (isFlush || once) flushed = true;

    const pending = [];
    /** @type {((value?: any) => void) | null} */
    let wakeConsumer = null;
    /** @type {((value?: any) => void) | null} */
    let resolveProducer = null;
    /** @type {((reason?: any) => void) | null} */
    let rejectProducer = null;
    let done = false,
      error = null,
      cancelled = false,
      completed = false;
    const CANCEL = Symbol('cancel');

    const push = v => {
      if (cancelled) throw CANCEL;
      pending.push(v);
      if (wakeConsumer) {
        const w = wakeConsumer;
        wakeConsumer = null;
        w();
      }
      return new Promise((res, rej) => {
        resolveProducer = res;
        rejectProducer = rej;
      });
    };

    Promise.resolve()
      .then(() =>
        once
          ? drive(value, push)
          : isFlush
            ? flush(fns, stopAt, push, finished)
            : next(value, fns, 0, push)
      )
      .then(
        () => {},
        e => {
          if (e === CANCEL) return;
          error = e;
          if (!isFlush && e instanceof defs.Stop) stopAt = stopIndex(e, fns);
        }
      )
      .finally(() => {
        done = true;
        if (wakeConsumer) {
          const w = wakeConsumer;
          wakeConsumer = null;
          w();
        }
      });

    try {
      for (;;) {
        while (pending.length) {
          const v = pending.shift();
          if (resolveProducer) {
            const r = resolveProducer;
            resolveProducer = rejectProducer = null;
            r();
          }
          yield v;
        }
        if (error) throw error;
        if (done) {
          completed = true;
          return;
        }
        await new Promise(res => (wakeConsumer = res));
      }
    } finally {
      cancelled = true;
      push[cancelSymbol] = CANCEL;
      if (rejectProducer) {
        const rj = rejectProducer;
        resolveProducer = rejectProducer = null;
        rj(CANCEL);
      }
      // an error or a break: release the resource-owning stages not finished (never a
      // flush); after a stop, only those up to the stopper, the rest waiting for the
      // caller's flush
      if (!completed && canAbort) {
        const failure =
          error instanceof defs.Stop
            ? await releaseStopped(fns, finished, error)
            : await abortStages(fns, finished);
        if (failure !== undefined) throw withCleanupError(error, failure);
      }
    }
  };

  if (once) return g;
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

// Factory parallel to fun()/gen(): normalize the fn-list (flatten, unwrap nested
// function-lists, default to identity) and return a push-driven function tagged
// as a function-list. The driver is `(value, push) => void | Promise`; calling
// it with `none` flushes: after a `stop`, only the stages after the stopper.
const exec = (...fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false,
    stopAt = 0;
  const noteStop = error => {
    if (error instanceof defs.Stop) stopAt = stopIndex(error, fns);
    throw error;
  };
  let g = (value, push) => {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value === defs.none) {
      flushed = true;
      return flush(fns, stopAt, push);
    }
    let r;
    try {
      r = next(value, fns, 0, push);
    } catch (error) {
      noteStop(error);
    }
    return r && typeof r.then == 'function' ? r.then(undefined, noteStop) : r;
  };
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

export default exec;
export {
  exec,
  next,
  flush,
  withCleanupError,
  cancelSymbol,
  hasAborters,
  noteFinal,
  abortStages,
  stopIndex,
  releaseStopped,
  finishStop,
  genBridge
};
