// @ts-self-types="./asStream.d.ts"

// Wraps a function as a Node Duplex with per-item backpressure. When
// stream.push() returns false, the next push returns a Promise that resolves
// on the next read(). Queue stays at hwm + 1 regardless of how many outputs
// one input chunk produces.

import {Duplex} from 'node:stream';
import * as defs from './defs.js';

const asStream = (fn, options) => {
  if (typeof fn != 'function') {
    throw TypeError('Only a function is accepted as the first argument');
  }

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;

  let stopped = false;
  let nullPushed = false;
  let resolvePaused = null;
  let stream = null;

  const resume = () => {
    if (!resolvePaused) return;
    const resolve = resolvePaused;
    resolvePaused = null;
    resolve();
  };

  // Idempotent: prevents 'error' from push-after-end on duplicate end signals.
  const signalEnd = () => {
    if (nullPushed) return;
    nullPushed = true;
    stream.push(null);
  };

  // After Stop / destroy, enqueue silently no-ops so producers see clean
  // completion instead of push-after-end errors.
  const enqueue = value => {
    if (stopped) return;
    if (!stream.push(value)) {
      return new Promise(resolve => { resolvePaused = resolve; });
    }
  };

  // applyFns is unconditionally async — per-item backpressure between pushes
  // requires awaits at every push site.
  const applyFns = innerFns
    ? async function apply(value, i, push) {
        for (;;) {
          if (value && typeof value.then == 'function') {
            value = await value;
            continue;
          }
          if (value == null || value === defs.none) return;
          if (value === defs.stop) throw new defs.Stop();
          if (defs.isFinalValue(value)) {
            const r = push(defs.getFinalValue(value));
            if (r) await r;
            return;
          }
          if (defs.isMany(value)) {
            const values = defs.getManyValues(value);
            if (i >= innerFns.length) {
              for (let j = 0; j < values.length; ++j) {
                const r = push(values[j]);
                if (r) await r;
              }
              return;
            }
            for (let j = 0; j < values.length; ++j) {
              await apply(values[j], i, push);
            }
            return;
          }
          if (value && typeof value.next == 'function') {
            for (;;) {
              let data = value.next();
              if (data && typeof data.then == 'function') data = await data;
              if (data.done) break;
              await apply(data.value, i, push);
            }
            return;
          }
          if (i >= innerFns.length) {
            const r = push(value);
            if (r) await r;
            return;
          }
          value = innerFns[i++](value);
        }
      }
    : null;

  // Slow-path generator queue (preserves iterator state across re-entry).
  const queue = [];

  const pump = async () => {
    while (queue.length) {
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

  // Sync-when-possible: returns undefined for plain non-backpressured paths,
  // returns a Promise for promise unwrap / pump drain / backpressure await.
  // Array-of-Many is iterated directly — no iterator allocation per Many.
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
      return pump();
    }
    return enqueue(value);
  };

  const absorbStop = error => {
    if (error instanceof defs.Stop) {
      stopped = true;
      signalEnd();
      return true;
    }
    return false;
  };

  const finishWrite = (callback, error) => {
    if (!error) return callback(null);
    if (absorbStop(error)) return callback(null);
    callback(error);
  };

  stream = new Duplex({
    writableObjectMode: true,
    readableObjectMode: true,
    ...options,
    write(chunk, encoding, callback) {
      if (stopped) return callback(null);
      if (applyFns) {
        applyFns(chunk, 0, enqueue).then(
          () => callback(null),
          error => finishWrite(callback, error)
        );
        return;
      }
      let r;
      try {
        r = processValue(fn(chunk, encoding));
      } catch (error) {
        return finishWrite(callback, error);
      }
      if (r) {
        r.then(() => callback(null), error => finishWrite(callback, error));
      } else {
        callback(null);
      }
    },
    final(callback) {
      const onComplete = () => { signalEnd(); callback(null); };
      if (applyFns) {
        (async () => {
          for (let i = 0; i < innerFns.length; ++i) {
            if (defs.isFlushable(innerFns[i])) {
              await applyFns(innerFns[i](defs.none), i + 1, enqueue);
            }
          }
        })().then(onComplete, error => finishWrite(callback, error));
        return;
      }
      if (!defs.isFlushable(fn)) {
        onComplete();
        return;
      }
      let r;
      try {
        r = processValue(fn(defs.none, null));
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
      stopped = true;
      resume();
      callback(error);
    }
  });

  return stream;
};

export default asStream;
export {asStream};
