'use strict';

const {none} = require('../defs');

const skipWhile = f => {
  let test = true;
  return value => {
    if (!test) return value;
    const result = f(value);
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

module.exports = skipWhile;
