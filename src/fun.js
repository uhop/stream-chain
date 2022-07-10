'use strict';

const defs = require('./defs');

const next = async (value, fns, index, collect) => {
  let cleanIndex;
  try {
    for (let i = index; i <= fns.length; ++i) {
      if (value && typeof value.then == 'function') {
        // thenable
        value = await value;
      }
      if (value === defs.none) break;
      if (value === defs.stop) {
        cleanIndex = i - 1;
        throw new defs.Stop();
      }
      if (value && value[defs.finalSymbol] === 1) {
        collect(value.value);
        break;
      }
      if (value && value[defs.manySymbol] === 1) {
        const values = value.values;
        if (i == fns.length) {
          values.forEach(val => collect(val));
        } else {
          for (let j = 0; j < values.length; ++j) {
            await next(values[j], fns, i, collect);
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
            collect(data.value);
          } else {
            await next(data.value, fns, i, collect);
          }
        }
        break;
      }
      if (i == fns.length) {
        collect(value);
        break;
      }
      cleanIndex = i + 1;
      const f = fns[i];
      value = f(value);
    }
  } catch (error) {
    if (error instanceof defs.Stop) {
      await flush(fns, cleanIndex, collect);
    }
    throw error;
  }
};

const flush = async (fns, index, collect) => {
  for (let i = index; i < fns.length; ++i) {
    const f = fns[i];
    if (f[defs.flushSymbol] === 1) {
      await next(f(defs.none), fns, i + 1, collect);
    }
  }
};

const collect = (collect, fns) => {
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
  const g = async value => {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value !== defs.none) {
      await next(value, fns, 0, collect);
    } else {
      flushed = true;
      await flush(fns, 0, collect);
    }
  };
  const needToFlush = fns.some(fn => fn[defs.flushSymbol] === 1);
  return needToFlush ? defs.flushable(g) : g;
};

const asArray = (...fns) => {
  let results = null;
  const f = collect(value => results.push(value), fns);
  let g = async value => {
    results = [];
    await f(value);
    const r = results;
    results = null;
    return r;
  };
  if (f[defs.flushSymbol] === 1) g = defs.flushable(g);
  return g;
};

const fun = (...fns) => {
  const f = asArray(...fns);
  let g = async value =>
    f(value).then(results => {
      switch (results.length) {
        case 0:
          return defs.none;
        case 1:
          return results[0];
      }
      return {[defs.manySymbol]: 1, values: results};
    });
  if (f[defs.flushSymbol] === 1) g = defs.flushable(g);
  return g;
};

fun.next = next;
fun.collect = collect;
fun.asArray = asArray;

Object.assign(fun, defs);

module.exports = fun;

// to keep ESM happy
module.exports.next = next;
module.exports.collect = collect;
module.exports.asArray = asArray;
