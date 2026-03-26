// @ts-self-types="./fun.d.ts"

'use strict';

const defs = require('./defs');

const next = (value, fns, index, collect) => {
  let cleanIndex;
  try {
    for (let i = index; i <= fns.length; ++i) {
      if (value && typeof value.then == 'function') {
        return value.then(v => next(v, fns, i, collect));
      }
      if (value === defs.none) return;
      if (value === defs.stop) {
        cleanIndex = i - 1;
        throw new defs.Stop();
      }
      if (defs.isFinalValue(value)) {
        collect(defs.getFinalValue(value));
        return;
      }
      if (defs.isMany(value)) {
        const values = defs.getManyValues(value);
        if (i == fns.length) {
          values.forEach(val => collect(val));
          return;
        }
        let pending;
        for (let j = 0; j < values.length; ++j) {
          if (pending) {
            const jj = j;
            pending = pending.then(() => next(values[jj], fns, i, collect));
          } else {
            const result = next(values[j], fns, i, collect);
            if (result && typeof result.then == 'function') pending = result;
          }
        }
        return pending;
      }
      if (value && typeof value.next == 'function') {
        return (async () => {
          for (;;) {
            let data = value.next();
            if (data && typeof data.then == 'function') {
              data = await data;
            }
            if (data.done) break;
            if (i == fns.length) {
              collect(data.value);
            } else {
              const result = next(data.value, fns, i, collect);
              if (result && typeof result.then == 'function') await result;
            }
          }
        })();
      }
      if (i == fns.length) {
        collect(value);
        return;
      }
      cleanIndex = i + 1;
      const f = fns[i];
      value = f(value);
    }
  } catch (error) {
    if (error instanceof defs.Stop) {
      const flushResult = flush(fns, cleanIndex, collect);
      if (flushResult && typeof flushResult.then == 'function') {
        return flushResult.then(() => {
          throw error;
        });
      }
    }
    throw error;
  }
};

const flush = (fns, index, collect) => {
  let pending;
  for (let i = index; i < fns.length; ++i) {
    const f = fns[i];
    if (defs.isFlushable(f)) {
      if (pending) {
        const ii = i;
        pending = pending.then(() => next(f(defs.none), fns, ii + 1, collect));
      } else {
        const result = next(f(defs.none), fns, i + 1, collect);
        if (result && typeof result.then == 'function') pending = result;
      }
    }
  }
  return pending;
};

const collect = (collect, fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false;
  let g = value => {
    if (flushed) throw Error('Call to a flushed pipe.');
    if (value !== defs.none) {
      return next(value, fns, 0, collect);
    } else {
      flushed = true;
      return flush(fns, 0, collect);
    }
  };
  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

const asArray = (...fns) => {
  let results = null;
  const f = collect(value => results.push(value), fns);
  let g = value => {
    results = [];
    const pending = f(value);
    if (pending && typeof pending.then == 'function') {
      return pending.then(() => {
        const r = results;
        results = null;
        return r;
      });
    }
    const r = results;
    results = null;
    return r;
  };
  if (defs.isFlushable(f)) g = defs.flushable(g);
  return defs.setFunctionList(g, defs.getFunctionList(f));
};

const fun = (...fns) => {
  const f = asArray(...fns);
  let g = value => {
    const result = f(value);
    if (result && typeof result.then == 'function') {
      return result.then(results => defs.many(results));
    }
    return defs.many(result);
  };
  if (defs.isFlushable(f)) g = defs.flushable(g);
  return defs.setFunctionList(g, defs.getFunctionList(f));
};

module.exports = fun;

module.exports.next = next;
module.exports.collect = collect;
module.exports.asArray = asArray;
