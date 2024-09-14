// @ts-self-types="./readableFrom.d.ts"

'use strict';

const {Readable} = require('node:stream');
const defs = require('../defs');

const readableFrom = options => {
  if (!options || !options.iterable) {
    options = {iterable: options};
  }
  let fn = options && options.iterable;
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
      await paused;
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

    if (!stream.push(value)) {
      pause();
    }
  };
  const startPump = async () => {
    try {
      const value = fn();
      await processValue(value);
      stream.push(null);
    } catch (error) {
      if (error instanceof defs.Stop) {
        stream.push(null);
        stream.destroy();
        return;
      }
      throw error;
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

  stream = new Readable(
    Object.assign({objectMode: true}, options, {
      read() {
        resume();
      }
    })
  );

  startPump();
  return stream;
};

module.exports = readableFrom;
