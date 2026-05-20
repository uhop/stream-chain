// @ts-self-types="./asWebStream.d.ts"

// asWebStream returns a Web Streams duplex pair ({readable, writable}) that
// runs `fn` per chunk. Per-item backpressure: when desiredSize drops to 0
// after enqueue, the next push returns a Promise that resolves on the next
// pull(). Queue stays at hwm + 1.
//
// NOT a TransformStream — TransformStream.transform() can't suspend mid-call
// to await consumer drain, which is what per-item backpressure needs.

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

const asWebStream = (fn, options) => {
  if (isDuplexWebStream(fn) || isReadableWebStream(fn) || isWritableWebStream(fn)) {
    return fn;
  }
  if (typeof fn !== 'function') {
    throw new TypeError(
      'Only a function or Web Streams object is accepted as the first argument'
    );
  }

  // Web Streams' standard `QueuingStrategy` shape ({highWaterMark, size}).
  // `strategy` is shorthand for "apply to both sides"; per-side wins.
  const strategy = options && options.strategy;
  const readableStrategy = (options && options.readableStrategy) || strategy;
  const writableStrategy = (options && options.writableStrategy) || strategy;

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

  // Idempotent: cancel() marks `readableClosed` because the consumer side
  // auto-closes the controller (re-calling close() would throw).
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

  // Mirror TransformStream: cancel on the readable side propagates to the
  // writable as an error so the producer learns the consumer gave up.
  const errorWritable = reason => {
    if (writableErrored || !writableController) return;
    writableErrored = true;
    writableController.error(reason);
  };

  const readable = new ReadableStream(
    {
      start(c) { readableController = c; },
      pull() { unblockDrain(); },
      cancel(reason) {
        stopped = true;
        readableClosed = true;
        unblockDrain();
        errorWritable(reason);
      }
    },
    readableStrategy
  );

  // After cancel/abort, enqueue silently no-ops so producers see clean
  // completion instead of TypeError from enqueue-on-closed-controller.
  const enqueue = value => {
    if (stopped) return;
    readableController.enqueue(value);
    if (readableController.desiredSize <= 0) {
      return new Promise(resolve => { pendingDrain = resolve; });
    }
  };

  // applyFns is unconditionally async: per-item backpressure between pushes
  // requires awaits at every push site. Same structure as asStream's apply.
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
      return true;
    }
    return false;
  };

  const writable = new WritableStream(
    {
      // `controller.signal` aborts during writer.abort() BEFORE the sink's
      // abort() callback runs. The spec waits for in-flight write() to
      // settle first — so if write() is awaiting pendingDrain, we'd
      // deadlock unless the signal listener wakes it.
      start(controller) {
        writableController = controller;
        controller.signal.addEventListener('abort', () => {
          stopped = true;
          unblockDrain();
        });
      },
      async write(chunk) {
        if (stopped) return;
        try {
          if (applyFns) {
            await applyFns(chunk, 0, enqueue);
            return;
          }
          const r = processValue(fn(chunk));
          if (r) await r;
        } catch (error) {
          if (absorbStop(error)) return;
          // Propagate user-function errors to the readable side so downstream
          // consumers (and pipeTo'd stages) learn — matches TransformStream.
          errorReadable(error);
          throw error;
        }
      },
      async close() {
        try {
          if (!stopped) {
            if (applyFns) {
              for (let i = 0; i < innerFns.length; ++i) {
                if (defs.isFlushable(innerFns[i])) {
                  await applyFns(innerFns[i](defs.none), i + 1, enqueue);
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

export default asWebStream;
export {asWebStream, isReadableWebStream, isWritableWebStream, isDuplexWebStream};
