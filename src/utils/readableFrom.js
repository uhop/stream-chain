// @ts-self-types="./readableFrom.d.ts"

import {Readable} from 'node:stream';
import * as defs from '../defs.js';
import {withCleanupError} from '../exec.js';

const CANCEL = Symbol.for('object-stream.readableFromCancel');
const SOURCE_IDLE = 0;
const SOURCE_CALLING = 1;
const SOURCE_PENDING = 2;

const readableFrom = options => {
  if (!options?.iterable) {
    options = {iterable: options};
  }
  let fn = options?.iterable;
  if (fn && typeof fn != 'function') {
    if (typeof fn[Symbol.asyncIterator] == 'function') {
      fn = fn[Symbol.asyncIterator].bind(fn);
    } else if (typeof fn[Symbol.iterator] == 'function') {
      fn = fn[Symbol.iterator].bind(fn);
    } else {
      fn = null;
    }
  }
  if (!fn)
    throw TypeError(
      'Only a function or an object with an iterator is accepted as the first argument'
    );

  // pump variables
  let paused = Promise.resolve(),
    resolvePaused = null;
  const queue = [];
  let cancelled = false,
    sourceState = SOURCE_IDLE;

  // pause/resume
  const resume = () => {
    if (!resolvePaused) return;
    resolvePaused();
    resolvePaused = null;
    paused = Promise.resolve();
  };
  const pause = () => {
    if (resolvePaused) return;
    paused = new Promise(resolve => (resolvePaused = resolve));
  };

  let stream = null; // will be assigned later

  // data processing
  const pushResults = values => {
    if (values && typeof values.next == 'function') {
      // generator
      queue.push(values);
      return;
    }
    // array
    queue.push(values[Symbol.iterator]());
  };
  const release = async (error, concurrent) => {
    let failure = error === CANCEL ? undefined : error,
      failed = error !== CANCEL && !defs.isStop(error);
    const close = async gen => {
      try {
        if (gen.return) await gen.return();
        return null;
      } catch (error) {
        return {error};
      }
    };
    const pending = [];
    // A woken pump can also enter release.
    for (const gen of queue.splice(0).reverse()) {
      const result = close(gen);
      pending.push(concurrent ? result : await result);
    }
    for (const result of concurrent ? await Promise.all(pending) : pending) {
      if (result) {
        failure = withCleanupError(failure, result.error);
        failed = true;
      }
    }
    if (failed && !defs.isStop(failure)) throw failure;
  };
  const pump = async () => {
    while (queue.length) {
      if (cancelled) throw CANCEL;
      await paused;
      if (cancelled) throw CANCEL;
      const gen = queue[queue.length - 1];
      sourceState = SOURCE_CALLING;
      let result = gen.next();
      if (result && typeof result.then == 'function') {
        sourceState = SOURCE_PENDING;
        result = await result;
      }
      sourceState = SOURCE_IDLE;
      if (result.done) {
        if (queue[queue.length - 1] === gen) queue.pop();
        continue;
      }
      let value = result.value;
      if (value && typeof value.then == 'function') {
        sourceState = SOURCE_PENDING;
        value = await value;
        sourceState = SOURCE_IDLE;
      }
      await sanitize(value);
    }
  };
  const sanitize = async value => {
    if (cancelled) {
      if (defs.isMany(value)) {
        pushResults(defs.getManyValues(value));
      } else if (defs.isFinalValue(value)) {
        return processValue(defs.getFinalValue(value));
      }
      throw CANCEL;
    }
    if (value === undefined || value === null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();

    if (defs.isMany(value)) {
      pushResults(defs.getManyValues(value));
      return pump();
    }

    if (defs.isFinalValue(value)) {
      // a final value is not supported, it is treated as a regular value
      value = defs.getFinalValue(value);
      return processValue(value);
    }

    if (!stream.push(value)) {
      pause();
    }
  };
  const startPump = async () => {
    try {
      if (cancelled) return;
      sourceState = SOURCE_CALLING;
      const value = fn();
      sourceState = SOURCE_IDLE;
      await processValue(value);
      if (!cancelled) stream.push(null);
    } catch (error) {
      sourceState = SOURCE_IDLE;
      await release(error, false);
      if (!cancelled) stream.push(null);
    }
  };
  const processValue = async value => {
    if (value && typeof value.then == 'function') {
      // thenable
      sourceState = SOURCE_PENDING;
      value = await value;
      sourceState = SOURCE_IDLE;
      return processValue(value);
    }
    if (value && typeof value.next == 'function') {
      // generator
      pushResults(value);
      return pump();
    }
    return sanitize(value);
  };

  const destroy = options.destroy;
  stream = new Readable({
    objectMode: true,
    ...options,
    read() {
      resume();
    },
    destroy(error, callback) {
      cancelled = true;
      const state = sourceState;
      resume();
      const finish = failure => {
        try {
          if (typeof destroy === 'function') {
            destroy.call(this, failure, callback);
          } else {
            callback(failure);
          }
        } catch (destroyError) {
          callback(destroyError);
        }
      };
      const concurrent = state !== SOURCE_IDLE;
      // A source can destroy its stream while its generator is still executing.
      const cleanup =
        state === SOURCE_CALLING
          ? Promise.resolve().then(() => release(CANCEL, concurrent))
          : release(CANCEL, concurrent);
      if (state !== SOURCE_IDLE) {
        cleanup.catch(() => {});
        finish(error);
        return;
      }
      cleanup.then(
        () => finish(error),
        failure => finish(failure === error ? error : withCleanupError(error, failure))
      );
    }
  });

  startPump().catch(error => {
    if (!cancelled) stream.destroy(error);
  });
  return stream;
};

export default readableFrom;
export {readableFrom};
