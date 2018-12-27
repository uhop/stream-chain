'use strict';

const {none, Final, Many} = require('../defs');

const next = async function*(value, fns, index) {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value === none) break;
    if (value instanceof Final) {
      if (value !== none) yield value;
      break;
    }
    if (value instanceof Many) {
      const values = value.values;
      if (i == fns.length) {
        for (let j = 0; j < values.length; ++j) {
          yield values[j];
        }
      } else {
        for (let j = 0; j < values.length; ++j) {
          yield* next(values[j], fns, i);
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
          yield data.value;
        } else {
          yield* next(data.value, fns, i);
        }
      }
      break;
    }
    if (i == fns.length) {
      yield value;
      break;
    }
    value = fns[i](value);
  }
};

const nop = async function*() {};

const asGen = (...fns) => {
  fns = fns.filter(fn => fn);
  if (!fns.length) return nop;
  return async function*(value) {
    yield* next(value, fns, 0);
  };
};

asGen.next = next;

asGen.none = none;
asGen.Final = Final;
asGen.Many = Many;

module.exports = asGen;
