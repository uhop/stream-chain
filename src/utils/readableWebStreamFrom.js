// @ts-self-types="./readableWebStreamFrom.d.ts"

import * as defs from '../defs.js';

const readableWebStreamFrom = options => {
  if (
    typeof options === 'function' ||
    (options &&
      (typeof options[Symbol.asyncIterator] === 'function' ||
        typeof options[Symbol.iterator] === 'function'))
  ) {
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

  // pause/resume gate — mirror of readableFrom (Node). Set when the readable's
  // desiredSize drops to 0 after enqueue; resolved from pull() on consumer demand.
  let paused = Promise.resolve(),
    resolvePaused = null;
  const queue = [];

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

  let controller = null;
  let cancelled = false;

  const pushResults = values => {
    if (values && typeof values.next == 'function') {
      queue.push(values);
      return;
    }
    queue.push(values[Symbol.iterator]());
  };

  const pump = async () => {
    while (queue.length) {
      if (cancelled) throw new defs.Stop();
      await paused;
      if (cancelled) throw new defs.Stop();
      const gen = queue[queue.length - 1];
      let result = gen.next();
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
      // a final value is not supported, it is treated as a regular value
      value = defs.getFinalValue(value);
      return processValue(value);
    }

    if (cancelled) throw new defs.Stop();
    controller.enqueue(value);
    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
      pause();
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

  const startPump = async () => {
    try {
      const value = fn();
      await processValue(value);
      if (!cancelled) controller.close();
    } catch (error) {
      if (cancelled) return;
      if (error instanceof defs.Stop) {
        controller.close();
        return;
      }
      controller.error(error);
    }
  };

  const strategy = options.strategy;

  return new ReadableStream(
    {
      start(c) {
        controller = c;
        startPump();
      },
      pull() {
        resume();
      },
      cancel() {
        cancelled = true;
        resume();
      }
    },
    strategy
  );
};

export default readableWebStreamFrom;
export {readableWebStreamFrom};
