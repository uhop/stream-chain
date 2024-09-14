// @ts-self-types="./fold.d.ts"

'use strict';

const {none, flushable} = require('../defs');

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

module.exports = fold;
