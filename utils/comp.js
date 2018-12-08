'use strict';

const {Transform} = require('stream');

const {none, Final, Many, sanitize} = require('../index');

const next = async (value, fns, index, push) => {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value === none) break;
    if (value instanceof Final) {
      push(value.value);
      break;
    }
    if (value instanceof Many) {
      if (i == fns.length) {
        value.values.forEach(val => push(val));
        break;
      }
      const values = value.values;
      for (let j = 0; j < values.length; ++j) {
        await next(values[j], fns, i, push);
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
        await next(data.value, fns, i, push);
      }
      break;
    }
    const fn = fns[i];
    if (!fn) {
      push(value);
      break;
    }
    value = fn(value);
  }
};

const comp = (...fns) => {
  fns = fns.filter(fn => fn);
  return fns.length
    ? new Transform({
        writableObjectMode: true,
        readableObjectMode: true,
        transform(chunk, encoding, callback) {
          next(chunk, fns, 0, value => sanitize(value, this)).then(() => callback(null), error => callback(error));
        }
      })
    : null;
};

const nop = () => {};

comp.asFun = (...fns) => {
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

module.exports = comp;
