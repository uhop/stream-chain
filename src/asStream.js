// @ts-self-types="./asStream.d.ts"

// Wraps a function as a Node Duplex with per-item backpressure. When
// stream.push() returns false, the next push returns a Promise that resolves
// on the next read(). Queue stays at hwm + 1 regardless of how many outputs
// one input chunk produces.
//
// The fused multi-fn path runs on the shared value-or-promise executor
// (exec.next / exec.flush) — sync-when-possible, suspending only at a
// backpressuring push; the single-fn path keeps processValue. See
// [[projects/stream-chain/design/sync-when-possible-executor]].

import {Duplex} from 'node:stream';
import * as defs from './defs.js';
import {
  next as execNext,
  flush as execFlush,
  withCleanupError,
  cancelSymbol,
  hasAborters,
  noteFinal,
  abortStages,
  finishStop
} from './exec.js';

// Unwinds the producer after destroy(): a generator stage would otherwise run to
// its natural end (forever, if endless) into a dead stream.
const CANCEL = Symbol.for('object-stream.asStreamCancel');

const asStream = (fn, options) => {
  if (typeof fn != 'function') {
    throw TypeError('Only a function is accepted as the first argument');
  }

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;
  const stages = innerFns ?? [fn];
  const canAbort = hasAborters(stages),
    finished = new Set(); // see exec.js noteFinal

  let stopped = false;
  let destroyed = false;
  let flushed = false;
  let nullPushed = false;
  let resolvePaused = null;
  let rejectPaused = null;
  let stream = null;

  const resume = () => {
    if (!resolvePaused) return;
    const resolve = resolvePaused;
    resolvePaused = rejectPaused = null;
    resolve();
  };

  // Rejecting the parked push unwinds the producer even when later stages drop
  // every remaining value, so enqueue would never see `destroyed`.
  const cancelPaused = () => {
    if (!rejectPaused) return;
    const reject = rejectPaused;
    resolvePaused = rejectPaused = null;
    reject(CANCEL);
  };

  // Idempotent: prevents 'error' from push-after-end on duplicate end signals.
  const signalEnd = () => {
    if (nullPushed) return;
    nullPushed = true;
    stream.push(null);
  };

  // Once a stop has ended the readable side, enqueue silently no-ops so producers
  // see clean completion instead of push-after-end errors.
  const enqueue = value => {
    if (destroyed) throw CANCEL;
    if (nullPushed) return;
    if (!stream.push(value)) {
      return new Promise((resolve, reject) => {
        resolvePaused = resolve;
        rejectPaused = reject;
      });
    }
  };

  // Slow-path generator queue (preserves iterator state across re-entry) —
  // used by the single-fn processValue path below.
  const queue = [];

  const pump = async () => {
    while (queue.length) {
      if (destroyed) throw CANCEL; // a generator whose values all get dropped
      const g = queue[queue.length - 1];
      let result = g.next();
      if (result && typeof result.then == 'function') result = await result;
      if (result.done) {
        queue.pop();
        continue;
      }
      let value = result.value;
      if (value && typeof value.then == 'function') value = await value;
      const r = processValue(value);
      if (r) await r;
    }
  };

  // An abnormal exit leaves queued generators suspended at a yield; return()
  // them so their `finally` runs, then re-throw – mirrors exec's nextGen abort.
  const release = async error => {
    while (queue.length) {
      const g = queue.pop();
      try {
        if (g.return) await g.return();
      } catch (cleanupErr) {
        error = withCleanupError(error, cleanupErr);
      }
    }
    throw error;
  };

  // Sync-when-possible single-fn path: returns undefined for plain
  // non-backpressured paths, a Promise for promise unwrap / pump drain /
  // backpressure await. Array-of-Many is iterated directly.
  const processValue = value => {
    if (value && typeof value.then == 'function') {
      return value.then(processValue);
    }
    if (value == null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isMany(value)) {
      const values = defs.getManyValues(value);
      let promise;
      for (let i = 0; i < values.length; ++i) {
        if (promise) {
          const ii = i;
          promise = promise.then(() => processValue(values[ii]));
        } else {
          const r = processValue(values[i]);
          if (r) promise = r;
        }
      }
      return promise;
    }
    if (defs.isFinalValue(value)) {
      return processValue(defs.getFinalValue(value));
    }
    if (value && typeof value.next == 'function') {
      queue.push(value);
      return pump().catch(release);
    }
    return enqueue(value);
  };

  // A stop is a clean end: the stages after the stopper are flushed and the rest
  // released (finishStop), then the readable side ends.
  const finishWrite = (callback, error) => {
    if (!error || error === CANCEL) {
      callback(null);
    } else if (!(error instanceof defs.Stop)) {
      callback(error);
    } else {
      stopped = true;
      finishStop(stages, error, enqueue, finished).then(
        () => {
          flushed = true;
          signalEnd();
          callback(null);
        },
        failure => callback(failure)
      );
    }
  };

  stream = new Duplex({
    writableObjectMode: true,
    readableObjectMode: true,
    ...options,
    write(chunk, encoding, callback) {
      if (stopped) return callback(null);
      if (innerFns) {
        let r;
        try {
          r = execNext(chunk, innerFns, 0, enqueue);
        } catch (error) {
          return finishWrite(callback, error);
        }
        if (r && typeof r.then == 'function') {
          r.then(
            () => callback(null),
            error => finishWrite(callback, error)
          );
        } else {
          callback(null); // ran fully sync — no promise, no microtask
        }
        return;
      }
      let r;
      try {
        r = processValue(fn(chunk, encoding));
      } catch (error) {
        return finishWrite(callback, error);
      }
      if (r) {
        r.then(
          () => callback(null),
          error => finishWrite(callback, error)
        );
      } else {
        callback(null);
      }
    },
    final(callback) {
      const onComplete = () => {
        flushed = true;
        signalEnd();
        callback(null);
      };
      if (stopped) {
        onComplete(); // the stop already flushed the stages after the stopper
        return;
      }
      if (innerFns) {
        let r;
        try {
          r = execFlush(innerFns, 0, enqueue, finished);
        } catch (error) {
          return finishWrite(callback, error);
        }
        if (r && typeof r.then == 'function') {
          r.then(onComplete, error => finishWrite(callback, error));
        } else {
          onComplete();
        }
        return;
      }
      if (!defs.isFlushable(fn)) {
        onComplete();
        return;
      }
      let r;
      try {
        const value = fn(defs.none, null);
        r = processValue(noteFinal(value, fn, finished));
      } catch (error) {
        return finishWrite(callback, error);
      }
      if (r) {
        r.then(onComplete, error => finishWrite(callback, error));
      } else {
        onComplete();
      }
    },
    read() {
      resume();
    },
    // Unblock any pending paused-promise so an in-flight write can settle —
    // mirrors asWebStream's controller.signal listener for writer.abort().
    destroy(error, callback) {
      stopped = destroyed = true;
      enqueue[cancelSymbol] = CANCEL;
      cancelPaused();
      // release the stages not flushed or released yet, never flush
      if (flushed || !canAbort) {
        callback(error);
        return;
      }
      abortStages(stages, finished).then(failure =>
        callback(
          failure === undefined ? error : /** @type {Error} */ (withCleanupError(error, failure))
        )
      );
    }
  });

  return stream;
};

export default asStream;
export {asStream};
