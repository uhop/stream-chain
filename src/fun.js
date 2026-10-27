// @ts-self-types="./fun.d.ts"

// fun() runs a pipeline and collects every output into a single Many. It is now
// a thin adapter over the shared value-or-promise executor (exec.next): the
// collect sink never backpressures, so the executor stays synchronous on sync
// pipelines — exactly fun's old behavior, but with one dispatch engine shared
// with asStream/gen (single implementation, single correctness gate). See
// [[projects/stream-chain/design/sync-when-possible-executor]].
//
// Behavioral note vs. the previous bespoke trampoline: `stop` halts without
// flushing buffered flushables (consistent with gen(): the explicit `none` flush
// emits them, after a stop only those of the stages after the stopper), and a sync
// generator stage is iterated synchronously rather than always-async. Output
// values are unchanged.

import * as defs from './defs.js';
import {next, flush, stopIndex} from './exec.js';

const asArray = (...fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false,
    stopAt = 0; // after a stop, the flush starts at the stage after the stopper
  const noteStop = error => {
    if (defs.isStop(error)) stopAt = stopIndex(error, fns);
    throw error;
  };
  // results are per call: overlapping async calls must not share them (as in gen())
  let g = value => {
    if (flushed) throw Error('Call to a flushed pipe.');
    const results = [],
      push = v => {
        results.push(v);
      };
    let pending;
    if (value !== defs.none) {
      try {
        pending = next(value, fns, 0, push);
      } catch (error) {
        noteStop(error);
      }
    } else {
      flushed = true;
      pending = flush(fns, stopAt, push);
    }
    return pending && typeof pending.then == 'function'
      ? pending.then(() => results, noteStop)
      : results;
  };
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

const fun = (...fns) => {
  const f = asArray(...fns);
  let g = value => {
    const result = /** @type {any} */ (f(value));
    if (result && typeof result.then == 'function') {
      return result.then(results => defs.many(results));
    }
    return defs.many(result);
  };
  if (defs.isFlushable(f)) g = defs.flushable(g);
  return defs.setFunctionList(g, defs.getFunctionList(f));
};

export default fun;
export {fun};
