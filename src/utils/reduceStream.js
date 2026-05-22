// @ts-self-types="./reduceStream.d.ts"

import {Writable} from 'node:stream';

const defaultInitial = 0;
const defaultReducer = (_acc, value) => value;

const reduceStream = (options, initial) => {
  if (typeof options === 'function') {
    options = {reducer: options, initial};
  }
  const reducer = typeof options?.reducer === 'function' ? options.reducer : defaultReducer;

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
  stream.accumulator = options && 'initial' in options ? options.initial : defaultInitial;

  return stream;
};

export default reduceStream;
export {reduceStream};
