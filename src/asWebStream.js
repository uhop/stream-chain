// @ts-self-types="./asWebStream.d.ts"

// asWebStream is a structural clone of asStream — full-blown executor.
// PROPER per-item backpressure: applyFns awaits between enqueues. When
// controller.desiredSize <= 0 after an enqueue, the next push returns a Promise
// that resolves when pull() fires (= consumer requested more). The queue never
// swells beyond hwm — safe for unbounded streams.
//
// Returns {readable, writable} — a Web Streams duplex pair, not a TransformStream
// (TransformStream's per-chunk transform() can't suspend mid-call for consumer drain).

import * as defs from './defs.js';

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
  if (isDuplexWebStream(fn) || isReadableWebStream(fn) || isWritableWebStream(fn)) {
    return fn;
  }
  if (typeof fn !== 'function') {
    throw new TypeError(
      'Only a function or Web Streams object is accepted as the first argument'
    );
  }

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;

  let stopped = false;
  let readableController;
  let pendingDrain = null;

  const readable = new ReadableStream({
    start(c) {
      readableController = c;
    },
    pull() {
      const resolve = pendingDrain;
      if (resolve) {
        pendingDrain = null;
        resolve();
      }
    },
    cancel() {
      stopped = true;
      const resolve = pendingDrain;
      if (resolve) {
        pendingDrain = null;
        resolve();
      }
    }
  });

  // Per-item backpressure: enqueue, return Promise to await when over-capacity.
  // Promise resolves on the next pull() (consumer asked for more).
  const enqueue = value => {
    readableController.enqueue(value);
    if (
      readableController.desiredSize !== null &&
      readableController.desiredSize <= 0
    ) {
      return new Promise(resolve => {
        pendingDrain = resolve;
      });
    }
  };

  // Async applyFns: awaits between enqueues to honor per-item backpressure.
  // Same semantic structure as asStream's apply — just always async so the
  // per-item await pattern works cleanly.
  const applyFns = innerFns
    ? async function apply(value, i, push) {
        for (;;) {
          if (value && typeof value.then == 'function') {
            value = await value;
            continue;
          }
          if (value === undefined || value === null || value === defs.none) return;
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

  const queue = [];

  const pushResults = values => {
    if (values && typeof values.next == 'function') {
      queue.push(values);
      return;
    }
    queue.push(values[Symbol.iterator]());
  };

  const pump = async () => {
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
      await sanitize(value);
    }
  };

  const sanitize = async value => {
    if (value === undefined || value === null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isMany(value)) {
      pushResults(defs.getManyValues(value));
      return pump();
    }
    if (defs.isFinalValue(value)) {
      value = defs.getFinalValue(value);
      return processValue(value);
    }
    const r = enqueue(value);
    if (r) await r;
  };

  const processValue = async value => {
    if (value && typeof value.then == 'function') {
      return value.then(v => processValue(v));
    }
    if (value && typeof value.next == 'function') {
      pushResults(value);
      return pump();
    }
    return sanitize(value);
  };

  const processChunk = async chunk => {
    try {
      const value = fn(chunk);
      await processValue(value);
    } catch (error) {
      if (error instanceof defs.Stop) {
        stopped = true;
        return;
      }
      throw error;
    }
  };

  const writable = new WritableStream({
    async write(chunk) {
      if (stopped) return;

      if (applyFns) {
        try {
          await applyFns(chunk, 0, enqueue);
        } catch (error) {
          if (error instanceof defs.Stop) {
            stopped = true;
            return;
          }
          throw error;
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
          const r = enqueue(value);
          if (r) await r;
        }
        return;
      }

      // Async slow path.
      try {
        await processValue(value);
      } catch (error) {
        if (error instanceof defs.Stop) {
          stopped = true;
          return;
        }
        throw error;
      }
    },
    async close() {
      if (stopped) {
        readableController.close();
        return;
      }
      if (applyFns) {
        try {
          for (let i = 0; i < innerFns.length; ++i) {
            if (defs.isFlushable(innerFns[i])) {
              await applyFns(innerFns[i](defs.none), i + 1, enqueue);
            }
          }
        } catch (error) {
          if (!(error instanceof defs.Stop)) throw error;
          stopped = true;
        }
        readableController.close();
        return;
      }
      if (!defs.isFlushable(fn)) {
        readableController.close();
        return;
      }
      try {
        await processChunk(defs.none);
      } catch (error) {
        if (!(error instanceof defs.Stop)) throw error;
        stopped = true;
      }
      readableController.close();
    },
    abort(reason) {
      readableController.error(reason);
    }
  });

  return {readable, writable};
};

export default asWebStream;
export {asWebStream, isReadableWebStream, isWritableWebStream, isDuplexWebStream};
