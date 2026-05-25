// COPY of src/asStream.js (bench-only) with ONE change: the fused multi-fn path
// uses the prototype value-or-promise `exec` (bench/exec.js) instead of the
// `async function applyFns`. Everything else — Duplex, enqueue/backpressure,
// processValue single-fn path, Stop/flush, destroy — is identical, so a
// head-to-head against the real asStream isolates the executor swap.
//
// The win shows up in write(): when exec runs fully synchronously (no
// backpressure, no async), it returns undefined and we call callback(null)
// directly — no promise, no per-item microtask.

import {Duplex} from 'node:stream';
import * as defs from 'stream-chain/defs.js';
import exec from './exec.js';

const asStreamExec = (fn, options) => {
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

  const signalEnd = () => {
    if (nullPushed) return;
    nullPushed = true;
    stream.push(null);
  };

  const enqueue = value => {
    if (stopped) return;
    if (!stream.push(value)) {
      return new Promise(resolve => {
        resolvePaused = resolve;
      });
    }
  };

  // Slow-path generator queue (preserves iterator state across re-entry) —
  // used only by the single-fn processValue path below.
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
      if (innerFns) {
        let r;
        try {
          r = exec(chunk, innerFns, 0, enqueue);
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
        signalEnd();
        callback(null);
      };
      if (innerFns) {
        let pending;
        try {
          for (let i = 0; i < innerFns.length; ++i) {
            if (defs.isFlushable(innerFns[i])) {
              const fi = i;
              if (pending) {
                pending = pending.then(() =>
                  exec(innerFns[fi](defs.none), innerFns, fi + 1, enqueue)
                );
              } else {
                const r = exec(innerFns[i](defs.none), innerFns, i + 1, enqueue);
                if (r && typeof r.then == 'function') pending = r;
              }
            }
          }
        } catch (error) {
          return finishWrite(callback, error);
        }
        if (pending && typeof pending.then == 'function') {
          pending.then(onComplete, error => finishWrite(callback, error));
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
    destroy(error, callback) {
      stopped = true;
      resume();
      callback(error);
    }
  });

  return stream;
};

export default asStreamExec;
export {asStreamExec};
