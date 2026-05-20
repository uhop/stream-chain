// @ts-self-types="./fold.d.ts"

import {none, flushable} from '../defs.js';

const fold = (fn, acc) =>
  flushable(value => {
    if (value === none) {
      // clean up acc
      const result = acc;
      acc = null;
      return result;
    }
    const result = fn(acc, value);
    if (result && typeof result.then == 'function') {
      return result.then(result => {
        acc = result;
        return none;
      });
    }
    acc = result;
    return none;
  });

export default fold;
export {fold};
