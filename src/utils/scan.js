// @ts-self-types="./scan.d.ts"

'use strict';

const scan = (fn, acc) => value => {
  const result = fn(acc, value);
  if (result && typeof result.then == 'function') {
    return result.then(result => (acc = result));
  }
  return (acc = result);
};

module.exports = scan;
