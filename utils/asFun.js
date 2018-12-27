'use strict';

const {none, Final, Many} = require('../defs');

const next = async (value, fns, index, push) => {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value === none) break;
    if (value instanceof Final) {
      value !== none && push(value.value);
      break;
    }
    if (value instanceof Many) {
      const values = value.values;
      if (i == fns.length) {
        values.forEach(val => push(val));
      } else {
        for (let j = 0; j < values.length; ++j) {
          await next(values[j], fns, i, push);
        }
      }
      break;
    }
    if (value && typeof value.next == 'function') {
      // generator
      for (;;) {
        let data = value.next();
        if (data && typeof data.then == 'function') {
          data = await data;
        }
        if (data.done) break;
        if (i == fns.length) {
          push(data.value);
        } else {
          await next(data.value, fns, i, push);
        }
      }
      break;
    }
    if (i == fns.length) {
      push(value);
      break;
    }
    value = fns[i](value);
  }
};

const nop = () => {};

const asFun = (...fns) => {
  fns = fns.filter(fn => fn);
  if (!fns.length) return nop;
  return async value => {
    const results = [];
    await next(value, fns, 0, value => results.push(value));
    switch (results.length) {
      case 0:
        return none;
      case 1:
        return results[0];
    }
    return new Many(results);
  };
};

asFun.next = next;

asFun.none = none;
asFun.Final = Final;
asFun.Many = Many;

module.exports = asFun;
