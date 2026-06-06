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

const next = (value, fns, index, push) => {
  for (let i = index; ; ) {
    if (value && typeof value.then == 'function') {
      const ii = i;
      return value.then(v => next(v, fns, ii, push));
    }
    if (value == null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();
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
    value = fns[i++](value);
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
      let data = it.next();
      if (data && typeof data.then == 'function') {
        return data.then(d => {
          if (d.done) return;
          const r = next(d.value, fns, i, push);
          return r && typeof r.then == 'function' ? r.then(step) : step();
        });
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
    // If the source generator's own cleanup (its `finally`, fired by
    // `it.return()`) ALSO fails, keep both errors instead of dropping the
    // cleanup one. Combine only when `err` is a real Error — a non-Error
    // control sentinel (e.g. gen()'s CANCEL on consumer break) must keep its
    // identity so callers comparing against it still work.
    const onCleanupError = cleanupErr =>
      err instanceof Error
        ? new AggregateError([err, cleanupErr], 'pipeline error; generator cleanup also failed')
        : err;
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
// Mirrors fun.flush: each flushable's output threads through the stages after
// it, value-or-promise chained. Resumable `step` (same shape as nextMany) keeps
// live allocation O(1) in the number of flushable stages under backpressure.
const flush = (fns, index, push) => {
  const step = i => {
    for (; i < fns.length; ++i) {
      const f = fns[i];
      if (!defs.isFlushable(f)) continue;
      const r = next(f(defs.none), fns, i + 1, push);
      if (r && typeof r.then == 'function') {
        const ii = i;
        return r.then(() => step(ii + 1));
      }
    }
  };
  return step(index);
};

// Factory parallel to fun()/gen(): normalize the fn-list (flatten, unwrap nested
// function-lists, default to identity) and return a push-driven function tagged
// as a function-list. The driver is `(value, push) => void | Promise`; calling
// it with `none` flushes. Note `stop` halts without flushing buffered
// flushables — same as gen() (only `fun()` flushes on stop).
const exec = (...fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false;
  let g = (value, push) => {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value === defs.none) {
      flushed = true;
      return flush(fns, 0, push);
    }
    return next(value, fns, 0, push);
  };
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

export default exec;
export {exec, next, flush};
