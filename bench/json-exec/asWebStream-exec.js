// COPY of src/asWebStream.js (bench-only) with ONE change: the fused multi-fn
// path uses the prototype value-or-promise `exec` (bench/json-exec/exec.js)
// instead of the `async function applyFns`. Everything else — ReadableStream /
// WritableStream wiring, enqueue/desiredSize backpressure, processValue
// single-fn path, Stop/flush, cancel/abort — is identical, so a head-to-head
// against the real asWebStream isolates the executor swap.
//
// enqueue() returns undefined while desiredSize > 0 and a drain Promise once it
// hits 0 — the SAME value-or-promise contract as Node's. So `exec` stays
// synchronous through the per-token traversal and suspends only on a genuinely
// full queue, exactly as it does on Node.

import * as defs from 'stream-chain/defs.js';
import {isReadableWebStream, isWritableWebStream, isDuplexWebStream} from 'stream-chain/defs.js';
import exec from './exec.js';

const asWebStreamExec = (fn, options) => {
  if (isDuplexWebStream(fn) || isReadableWebStream(fn) || isWritableWebStream(fn)) {
    return fn;
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Only a function or Web Streams object is accepted as the first argument');
  }

  const strategy = options?.strategy;
  const readableStrategy = options?.readableStrategy ?? strategy;
  const writableStrategy = options?.writableStrategy ?? strategy;

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;

  let stopped = false;
  let readableClosed = false;
  let writableErrored = false;
  let readableController;
  let writableController;
  let pendingDrain = null;

  const unblockDrain = () => {
    if (!pendingDrain) return;
    const resolve = pendingDrain;
    pendingDrain = null;
    resolve();
  };

  const closeReadable = () => {
    if (readableClosed) return;
    readableClosed = true;
    readableController.close();
  };
  const errorReadable = reason => {
    if (readableClosed) return;
    readableClosed = true;
    readableController.error(reason);
  };

  const errorWritable = reason => {
    if (writableErrored || !writableController) return;
    writableErrored = true;
    writableController.error(reason);
  };

  const readable = new ReadableStream(
    {
      start(c) {
        readableController = c;
      },
      pull() {
        unblockDrain();
      },
      cancel(reason) {
        stopped = true;
        readableClosed = true;
        unblockDrain();
        errorWritable(reason);
      }
    },
    readableStrategy
  );

  const enqueue = value => {
    if (stopped) return;
    readableController.enqueue(value);
    if (readableController.desiredSize <= 0) {
      return new Promise(resolve => {
        pendingDrain = resolve;
      });
    }
  };

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
      return true;
    }
    return false;
  };

  const writable = new WritableStream(
    {
      start(controller) {
        writableController = controller;
        controller.signal?.addEventListener('abort', () => {
          stopped = true;
          unblockDrain();
        });
      },
      async write(chunk) {
        if (stopped) return;
        try {
          if (innerFns) {
            const r = exec(chunk, innerFns, 0, enqueue);
            if (r && typeof r.then == 'function') await r;
            return;
          }
          const r = processValue(fn(chunk));
          if (r) await r;
        } catch (error) {
          if (absorbStop(error)) return;
          errorReadable(error);
          throw error;
        }
      },
      async close() {
        try {
          if (!stopped) {
            if (innerFns) {
              for (let i = 0; i < innerFns.length; ++i) {
                if (defs.isFlushable(innerFns[i])) {
                  const r = exec(innerFns[i](defs.none), innerFns, i + 1, enqueue);
                  if (r && typeof r.then == 'function') await r;
                }
              }
            } else if (defs.isFlushable(fn)) {
              const r = processValue(fn(defs.none));
              if (r) await r;
            }
          }
        } catch (error) {
          if (!absorbStop(error)) {
            errorReadable(error);
            throw error;
          }
        }
        closeReadable();
      },
      abort(reason) {
        stopped = true;
        unblockDrain();
        errorReadable(reason);
      }
    },
    writableStrategy
  );

  return {readable, writable};
};

export default asWebStreamExec;
export {asWebStreamExec};
