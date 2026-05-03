// @ts-self-types="./reduceStream.d.ts"

'use strict';

const {Writable} = require('node:stream');

const defaultInitial = 0;
const defaultReducer = (_acc, value) => value;

const reduceStream = (options, initial) => {
  if (!options || !options.reducer) {
    options = {reducer: options, initial};
  }
  let accumulator = defaultInitial,
    reducer = defaultReducer;
  if (options) {
    'initial' in options && (accumulator = options.initial);
    'reducer' in options && (reducer = options.reducer);
  }

  const stream = /** @type {import('node:stream').Writable & {accumulator: any}} */ (
    new Writable({
      objectMode: true,
      ...options,
      /** @this {import('node:stream').Writable & {accumulator: any}} */
      write(chunk, _, callback) {
        const result = reducer.call(this, this.accumulator, chunk);
        if (result && typeof result.then == 'function') {
          result.then(
            value => {
              this.accumulator = value;
              callback(null);
            },
            error => callback(error)
          );
        } else {
          this.accumulator = result;
          callback(null);
        }
      }
    })
  );
  stream.accumulator = accumulator;

  return stream;
};

module.exports = reduceStream;
