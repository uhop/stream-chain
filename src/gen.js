// @ts-self-types="./gen.d.ts"

'use strict';

const defs = require('./defs');

const next = async function* (value, fns, index) {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value === defs.none) break;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isFinalValue(value)) {
      yield defs.getFinalValue(value);
      break;
    }
    if (defs.isMany(value)) {
      const values = defs.getManyValues(value);
      if (i == fns.length) {
        yield* values;
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
    const f = fns[i];
    value = f(value);
  }
};

const gen = (...fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false;
  let g = async function* (value) {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value !== defs.none) {
      yield* next(value, fns, 0);
    } else {
      flushed = true;
      for (let i = 0; i < fns.length; ++i) {
        const f = fns[i];
        if (defs.isFlushable(f)) {
          yield* next(f(defs.none), fns, i + 1);
        }
      }
    }
  };
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

module.exports = gen;

module.exports.next = next;
