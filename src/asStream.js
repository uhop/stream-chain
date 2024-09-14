// @ts-self-types="./asStream.d.ts"

'use strict';

const {Duplex} = require('node:stream');
const defs = require('./defs');

const asStream = (fn, options) => {
  if (typeof fn != 'function')
    throw TypeError(
      'Only a function is accepted as the first argument'
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
  const processChunk = async (chunk, encoding) => {
    try {
      const value = fn(chunk, encoding);
      await processValue(value);
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

  stream = new Duplex(
    Object.assign({writableObjectMode: true, readableObjectMode: true}, options, {
      write(chunk, encoding, callback) {
        processChunk(chunk, encoding).then(
          () => callback(null),
          error => callback(error)
        );
      },
      final(callback) {
        if (!defs.isFlushable(fn)) {
          stream.push(null);
          callback(null);
          return;
        }
        processChunk(defs.none, null).then(
          () => (stream.push(null), callback(null)),
          error => callback(error)
        );
      },
      read() {
        resume();
      }
    })
  );

  return stream;
};

module.exports = asStream;
