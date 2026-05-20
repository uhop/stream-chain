// @ts-self-types="./batch.d.ts"

import {none, flushable} from '../defs.js';

const batch = (n = 100) => {
  let buffer = [];
  return flushable(value => {
    if (value === none) {
      // clean up buffer
      if (!buffer.length) return none;
      const result = buffer;
      buffer = null;
      return result;
    }
    buffer.push(value);
    if (buffer.length < n) return none;
    const result = buffer;
    buffer = [];
    return result;
  });
};

export default batch;
export {batch};
