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
    if (value && value[defs.finalSymbol] === 1) {
      yield value.value;
      break;
    }
    if (value && value[defs.manySymbol] === 1) {
      const values = value.values;
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
  fns = fns.filter(fn => fn);
  if (fns.length) {
    if (Symbol.asyncIterator && fns[0][Symbol.asyncIterator]) {
      fns[0] = fns[0][Symbol.asyncIterator].bind(fns[0]);
    } else if (Symbol.iterator && fns[0][Symbol.iterator]) {
      fns[0] = fns[0][Symbol.iterator].bind(fns[0]);
    }
  } else {
    fns = [x => x];
  }
  let flushed = false;
  const g = async function* (value) {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value !== defs.none) {
      yield* next(value, fns, 0);
    } else {
      flushed = true;
      for (let i = 0; i < fns.length; ++i) {
        const f = fns[i];
        if (f[defs.flushSymbol] === 1) {
          yield* next(f(defs.none), fns, i + 1);
        }
      }
    }
  };
  const needToFlush = fns.some(fn => fn[defs.flushSymbol] === 1);
  return needToFlush ? defs.flushable(g) : g;
};

gen.next = next;

Object.assign(gen, defs);

module.exports = gen;
