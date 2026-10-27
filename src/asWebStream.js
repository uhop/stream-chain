// @ts-self-types="./asWebStream.d.ts"

// asWebStream returns a Web Streams duplex pair ({readable, writable}) that
// runs `fn` per chunk. Per-item backpressure: when desiredSize drops to 0
// after enqueue, the next push returns a Promise that resolves on the next
// pull(). Queue stays at hwm + 1.
//
// NOT a TransformStream — TransformStream.transform() can't suspend mid-call
// to await consumer drain, which is what per-item backpressure needs.

import * as defs from './defs.js';
import {isReadableWebStream, isWritableWebStream, isDuplexWebStream} from './defs.js';
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

// Unwinds the producer after cancel/abort: a generator stage would otherwise run
// to its natural end (forever, if endless) into a dead stream.
const CANCEL = Symbol.for('object-stream.asWebStreamCancel');

const asWebStream = (fn, options) => {
  if (isDuplexWebStream(fn) || isReadableWebStream(fn) || isWritableWebStream(fn)) {
    return fn;
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Only a function or Web Streams object is accepted as the first argument');
  }

  // Web Streams' standard `QueuingStrategy` shape ({highWaterMark, size}).
  // `strategy` is shorthand for "apply to both sides"; per-side wins.
  const strategy = options?.strategy;
  const readableStrategy = options?.readableStrategy ?? strategy;
  const writableStrategy = options?.writableStrategy ?? strategy;

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;
  const stages = innerFns ?? [fn];
  const canAbort = hasAborters(stages),
    finished = new Set(); // see exec.js noteFinal

  let stopped = false;
  let cancelled = false;
  let flushed = false;
  let releasing = null;
  let readableClosed = false;
  let writableErrored = false;
  let readableController;
  let writableController;
  let pendingDrain = null;
  let rejectDrain = null;

  const unblockDrain = () => {
    if (!pendingDrain) return;
    const resolve = pendingDrain;
    pendingDrain = rejectDrain = null;
    resolve();
  };

  // Rejecting the parked push unwinds the producer even when later stages drop
  // every remaining value, so enqueue would never see `cancelled`.
  const cancelDrain = () => {
    if (!rejectDrain) return;
    const reject = rejectDrain;
    pendingDrain = rejectDrain = null;
    reject(CANCEL);
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
      start(c) {
        readableController = c;
      },
      pull() {
        unblockDrain();
      },
      cancel(reason) {
        readableClosed = true;
        cancelProducer();
        errorWritable(reason);
        return releaseStages().then(rethrow);
      }
    },
    readableStrategy
  );

  // Once a stop has closed the readable side, enqueue silently no-ops so producers
  // see clean completion instead of TypeError from enqueue-on-closed-controller.
  const enqueue = value => {
    if (cancelled) throw CANCEL;
    if (readableClosed) return;
    readableController.enqueue(value);
    if (readableController.desiredSize <= 0) {
      return new Promise((resolve, reject) => {
        pendingDrain = resolve;
        rejectDrain = reject;
      });
    }
  };

  // Teardown: a parked push is rejected with CANCEL, and the push is marked so the
  // executor also stops a generator whose values never reach it
  const cancelProducer = () => {
    stopped = cancelled = true;
    enqueue[cancelSymbol] = CANCEL;
    cancelDrain();
  };

  // Releases the resource-owning stages not flushed or released yet; resolves to the
  // failure to surface, or undefined
  const releaseStages = () => {
    if (flushed || !canAbort) return Promise.resolve(undefined);
    releasing ??= abortStages(stages, finished);
    return releasing;
  };
  const rethrow = failure => {
    if (failure !== undefined) throw failure;
  };

  // Slow-path generator queue (preserves iterator state across re-entry) —
  // used by the single-fn processValue path below.
  const queue = [];

  const pump = async () => {
    while (queue.length) {
      if (cancelled) throw CANCEL; // a generator whose values all get dropped
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
      return pump().catch(release);
    }
    return enqueue(value);
  };

  // A stop is a clean end: the stages after the stopper are flushed and the rest
  // released (finishStop), then the readable side closes.
  const endAfterStop = async stop => {
    stopped = true;
    try {
      await finishStop(stages, stop, enqueue, finished);
    } catch (error) {
      errorReadable(error);
      throw error;
    }
    flushed = true;
    closeReadable();
  };

  const writable = new WritableStream(
    {
      // `controller.signal` aborts during writer.abort() BEFORE the sink's
      // abort() callback runs. The spec waits for in-flight write() to
      // settle first — so if write() is awaiting pendingDrain, we'd
      // deadlock unless the signal listener wakes it.
      // Optional-chained because Bun ≤1.3.14 returns `undefined` for the
      // controller's signal (spec-required per WHATWG Streams §4.5.2 but
      // missing in Bun's builtin — see oven-sh/bun#31156 / PR #31157).
      // Fixed upstream (present in Bun 1.4.0); the chaining stays for older
      // Bun, which only loses the abort wakeup.
      start(controller) {
        writableController = controller;
        controller.signal?.addEventListener('abort', cancelProducer);
      },
      async write(chunk) {
        if (stopped) return;
        try {
          if (innerFns) {
            const r = execNext(chunk, innerFns, 0, enqueue);
            if (r) await r;
            return;
          }
          const r = processValue(fn(chunk));
          if (r) await r;
        } catch (error) {
          if (error === CANCEL) return;
          if (defs.isStop(error)) return endAfterStop(error);
          // Propagate user-function errors to the readable side so downstream
          // consumers (and pipeTo'd stages) learn — matches TransformStream.
          errorReadable(error);
          const failure = await releaseStages();
          throw failure === undefined ? error : withCleanupError(error, failure);
        }
      },
      async close() {
        try {
          if (!stopped) {
            if (innerFns) {
              const r = execFlush(innerFns, 0, enqueue, finished);
              if (r) await r;
            } else if (defs.isFlushable(fn)) {
              const r = processValue(noteFinal(fn(defs.none), fn, finished));
              if (r) await r;
            }
            flushed = true;
          }
        } catch (error) {
          if (defs.isStop(error)) return endAfterStop(error);
          if (error !== CANCEL) {
            errorReadable(error);
            const failure = await releaseStages();
            throw failure === undefined ? error : withCleanupError(error, failure);
          }
        }
        closeReadable();
      },
      abort(reason) {
        cancelProducer();
        errorReadable(reason);
        return releaseStages().then(rethrow);
      }
    },
    writableStrategy
  );

  return {readable, writable};
};

export default asWebStream;
export {asWebStream, isReadableWebStream, isWritableWebStream, isDuplexWebStream};
