// @ts-self-types="./exec.d.ts"

// Sync-when-possible, value-or-promise executor. Threads a value through a
// function-list, emitting terminal values via a `push` callback. Unlike
// `fun.next` (whose collect return is ignored) the push return is HONORED: when
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

// Iterate a many() array, threading each element. Stay synchronous until one
// element returns a promise (a backpressure push, or genuine async); then chain
// the remainder so we suspend mid-array instead of flooding push.
const nextMany = (values, fns, i, push) => {
  let pending;
  for (let j = 0; j < values.length; ++j) {
    if (pending) {
      const jj = j;
      pending = pending.then(() => next(values[jj], fns, i, push));
    } else {
      const r = next(values[j], fns, i, push);
      if (r && typeof r.then == 'function') pending = r;
    }
  }
  return pending;
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
  return step();
};

// Flush flushable stages (called when the factory's driver receives `none`).
// Mirrors fun.flush: each flushable's output threads through the stages after
// it, value-or-promise chained.
const flush = (fns, index, push) => {
  let pending;
  for (let i = index; i < fns.length; ++i) {
    const f = fns[i];
    if (defs.isFlushable(f)) {
      if (pending) {
        const ii = i;
        pending = pending.then(() => next(f(defs.none), fns, ii + 1, push));
      } else {
        const r = next(f(defs.none), fns, i + 1, push);
        if (r && typeof r.then == 'function') pending = r;
      }
    }
  }
  return pending;
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

exec.next = next;
exec.flush = flush;

export default exec;
export {exec, next, flush};
