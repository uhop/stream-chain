'use strict';

const scan = (f, acc) => value => {
  const result = f(acc, value);
  if (result && typeof result.then == 'function') {
    return result.then(result => (acc = result));
  }
  return (acc = result);
};

module.exports = scan;
