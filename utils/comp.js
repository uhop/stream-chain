'use strict';

const {Final, Many} = require('../index');

const next = async (value, fns, index) => {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value instanceof Final) {
      return value.value;
    }
    if (value instanceof Many) {
      if (i == fns.length) return value;
      const results = [],
        values = value.values;
      for (let j = 0; j < values.length; ++j) {
        const result = await next(values[j], fns, i);
        if (result instanceof Many) {
          results.push(...result.values);
        } else {
          results.push(result);
        }
      }
      return new Many(results);
    }
    if (value && typeof value.next == 'function') {
      // generator
      const results = [];
      for (;;) {
        let data = value.next();
        if (data && typeof data.then == 'function') {
          data = await data;
        }
        if (data.done) break;
        const result = await next(data.value, fns, i);
        if (result instanceof Many) {
          results.push(...result.values);
        } else {
          results.push(result);
        }
      }
      return new Many(results);
    }
    const fn = fns[i];
    if (!fn) break;
    value = fn(value);
  }
  return value;
};

const comp = (...fns) => {
  fns = fns.filter(fn => fn);
  if (!fns.length) return null;
  return async value => next(value, fns, 0);
};

module.exports = comp;
