// @ts-self-types="./readableFrom.d.ts"

import {Readable} from 'node:stream';
import * as defs from '../defs.js';
import {withCleanupError} from '../exec.js';

const CANCEL = Symbol.for('object-stream.readable-source-cancel');

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
    running;

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
  const pump = async () => {
    while (queue.length) {
      if (cancelled) throw CANCEL;
      await paused;
      if (cancelled) throw CANCEL;
      const gen = queue[queue.length - 1];
      let result = gen.next();
      if (result && typeof result.then == 'function') {
        result = await result;
      }
      if (cancelled) throw CANCEL;
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
      const value = fn();
      await processValue(value);
      if (!cancelled) stream.push(null);
    } catch (error) {
      let failure = error === CANCEL ? undefined : error,
        failed = error !== CANCEL && !defs.isStop(error);
      while (queue.length) {
        const gen = queue.pop();
        try {
          if (gen.return) await gen.return();
        } catch (cleanupError) {
          failure = withCleanupError(failure, cleanupError);
          failed = true;
        }
      }
      if (failed && !defs.isStop(failure)) throw failure;
      if (!cancelled) stream.push(null);
    }
  };
  const processValue = async value => {
    if (value && typeof value.then == 'function') {
      // thenable
      return value.then(value => processValue(value));
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
      Promise.resolve()
        .then(() => running)
        .then(
          () => finish(error),
          failure => finish(failure === error ? error : withCleanupError(error, failure))
        );
    }
  });

  running = startPump();
  running.catch(error => stream.destroy(error));
  return stream;
};

export default readableFrom;
export {readableFrom};
