// @ts-self-types="./skipWhile.d.ts"

import {none} from '../defs.js';

const skipWhile = fn => {
  let test = true;
  return value => {
    if (!test) return value;
    const result = fn(value);
    if (result && typeof result.then == 'function') {
      return result.then(result => {
        if (result) return none;
        test = false;
        return value;
      });
    }
    if (result) return none;
    test = false;
    return value;
  };
};

export default skipWhile;
export {skipWhile};
