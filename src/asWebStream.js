// @ts-self-types="./asWebStream.d.ts"

// asWebStream is a structural clone of asStream — full-blown executor, not a
// thin layer over gen(). The fast path runs inner functions directly into
// controller.enqueue without per-step generator overhead; the slow path uses
// the same pump/queue/sanitize machinery as asStream for promises, generators,
// many, finalValue, and stop. Backpressure is handled by TransformStream's
// internal queue — transform/flush return a Promise when async work is in
// flight, which throttles the writable side.

import * as defs from './defs.js';

// Web Streams shape detection (duck-typed — no `node:*` imports).
const isReadableWebStream = x =>
  !!(x && typeof x === 'object' &&
    typeof x.getReader === 'function' &&
    typeof x.pipeTo === 'function');

const isWritableWebStream = x =>
  !!(x && typeof x === 'object' &&
    typeof x.getWriter === 'function' &&
    typeof x.abort === 'function');

const isDuplexWebStream = x =>
  !!(x && typeof x === 'object' &&
    isReadableWebStream(x.readable) && isWritableWebStream(x.writable));

const asWebStream = (fn, _options) => {
  // Dual role: pass through Web Streams objects unchanged.
  if (isDuplexWebStream(fn) || isReadableWebStream(fn) || isWritableWebStream(fn)) {
    return fn;
  }
  if (typeof fn !== 'function') {
    throw new TypeError(
      'Only a function or Web Streams object is accepted as the first argument'
    );
  }

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;

  // Fast path mirroring asStream's applyFns: inline the inner-function loop
  // so a chain of fns runs in one pass to enqueue, avoiding per-step gen yields.
  const applyFns = innerFns
    ? function apply(value, i, enqueue) {
        for (;;) {
          if (value && typeof value.then == 'function') return value.then(v => apply(v, i, enqueue));
          if (value === undefined || value === null || value === defs.none) return;
          if (value === defs.stop) throw new defs.Stop();
          if (defs.isFinalValue(value)) {
            enqueue(defs.getFinalValue(value));
            return;
          }
          if (defs.isMany(value)) {
            const values = defs.getManyValues(value);
            if (i >= innerFns.length) {
              for (let j = 0; j < values.length; ++j) enqueue(values[j]);
              return;
            }
            let pending;
            for (let j = 0; j < values.length; ++j) {
              if (pending) {
                const jj = j;
                pending = pending.then(() => apply(values[jj], i, enqueue));
              } else {
                const result = apply(values[j], i, enqueue);
                if (result) pending = result;
              }
            }
            return pending;
          }
          if (value && typeof value.next == 'function') {
            return (async () => {
              for (;;) {
                let data = value.next();
                if (data && typeof data.then == 'function') data = await data;
                if (data.done) break;
                const result = apply(data.value, i, enqueue);
                if (result) await result;
              }
            })();
          }
          if (i >= innerFns.length) {
            enqueue(value);
            return;
          }
          value = innerFns[i++](value);
        }
      }
    : null;

  let stopped = false;
  const queue = [];

  const pushResults = values => {
    if (values && typeof values.next == 'function') {
      queue.push(values);
      return;
    }
    queue.push(values[Symbol.iterator]());
  };

  const pump = async enqueue => {
    while (queue.length) {
      const g = queue[queue.length - 1];
      let result = g.next();
      if (result && typeof result.then == 'function') {
        result = await result;
      }
      if (result.done) {
        queue.pop();
        continue;
      }
      let value = result.value;
      if (value && typeof value.then == 'function') {
        value = await value;
      }
      await sanitize(value, enqueue);
    }
  };

  const sanitize = async (value, enqueue) => {
    if (value === undefined || value === null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isMany(value)) {
      pushResults(defs.getManyValues(value));
      return pump(enqueue);
    }
    if (defs.isFinalValue(value)) {
      value = defs.getFinalValue(value);
      return processValue(value, enqueue);
    }
    enqueue(value);
  };

  const processValue = async (value, enqueue) => {
    if (value && typeof value.then == 'function') {
      return value.then(v => processValue(v, enqueue));
    }
    if (value && typeof value.next == 'function') {
      pushResults(value);
      return pump(enqueue);
    }
    return sanitize(value, enqueue);
  };

  const processChunk = async (chunk, enqueue) => {
    try {
      const value = fn(chunk);
      await processValue(value, enqueue);
    } catch (error) {
      if (error instanceof defs.Stop) {
        stopped = true;
        return;
      }
      throw error;
    }
  };

  return new TransformStream({
    transform(chunk, controller) {
      if (stopped) return;
      const enqueue = v => controller.enqueue(v);

      // Fast path for gen() compositions: process inner functions directly.
      if (applyFns) {
        let result;
        try {
          result = applyFns(chunk, 0, enqueue);
        } catch (error) {
          if (error instanceof defs.Stop) {
            stopped = true;
            return;
          }
          throw error;
        }
        if (result && typeof result.then == 'function') {
          return result.catch(error => {
            if (error instanceof defs.Stop) {
              stopped = true;
              return;
            }
            throw error;
          });
        }
        return;
      }

      let value;
      try {
        value = fn(chunk);
      } catch (error) {
        if (error instanceof defs.Stop) {
          stopped = true;
          return;
        }
        throw error;
      }

      // Sync fast path: plain value (not promise/generator/special).
      if (
        !(value && (typeof value.then == 'function' || typeof value.next == 'function')) &&
        value !== defs.stop &&
        !defs.isMany(value) &&
        !defs.isFinalValue(value)
      ) {
        if (value !== undefined && value !== null && value !== defs.none) {
          enqueue(value);
        }
        return;
      }

      // Async slow path: promises, generators, many, finalValue, stop.
      return processValue(value, enqueue).catch(error => {
        if (error instanceof defs.Stop) {
          stopped = true;
          return;
        }
        throw error;
      });
    },
    flush(controller) {
      const enqueue = v => controller.enqueue(v);

      // Fast path: flush inner flushable functions of a gen() composition.
      if (applyFns) {
        let asyncChain;
        try {
          for (let i = 0; i < innerFns.length; ++i) {
            if (defs.isFlushable(innerFns[i])) {
              if (asyncChain) {
                const ii = i;
                asyncChain = asyncChain.then(() =>
                  applyFns(innerFns[ii](defs.none), ii + 1, enqueue)
                );
              } else {
                const result = applyFns(innerFns[i](defs.none), i + 1, enqueue);
                if (result && typeof result.then == 'function') asyncChain = result;
              }
            }
          }
        } catch (error) {
          if (error instanceof defs.Stop) {
            stopped = true;
            return;
          }
          throw error;
        }
        if (asyncChain) {
          return asyncChain.catch(error => {
            if (error instanceof defs.Stop) {
              stopped = true;
              return;
            }
            throw error;
          });
        }
        return;
      }

      if (!defs.isFlushable(fn)) return;
      return processChunk(defs.none, enqueue);
    }
  });
};

export default asWebStream;
export {asWebStream, isReadableWebStream, isWritableWebStream, isDuplexWebStream};
