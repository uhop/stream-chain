// @ts-self-types="./takeWhile.d.ts"

'use strict';

const {none} = require('../defs');

const takeWhile = (fn, finalValue = none) => {
  let test = true;
  return value => {
    if (!test) return finalValue;
    const result = fn(value);
    if (result && typeof result.then == 'function') {
      return result.then(result => {
        if (result) return value;
        test = false;
        return finalValue;
      });
    }
    if (result) return value;
    test = false;
    return finalValue;
  };
};

module.exports = takeWhile;
