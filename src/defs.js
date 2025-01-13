// @ts-self-types="./defs.d.ts"

'use strict';

const none = Symbol.for('object-stream.none');
const stop = Symbol.for('object-stream.stop');

const finalSymbol = Symbol.for('object-stream.final');
const manySymbol = Symbol.for('object-stream.many');
const flushSymbol = Symbol.for('object-stream.flush');
const fListSymbol = Symbol.for('object-stream.fList');

const finalValue = value => ({[finalSymbol]: 1, value});
const many = values => ({[manySymbol]: 1, values});

const isFinalValue = o => o && o[finalSymbol] === 1;
const isMany = o => o && o[manySymbol] === 1;
const isFlushable = o => o && o[flushSymbol] === 1;
const isFunctionList = o => o && o[fListSymbol] === 1;

const getFinalValue = o => o.value;
const getManyValues = o => o.values;
const getFunctionList = o => o.fList;

const flushable = (write, final = null) => {
  const fn = final ? value => (value === none ? final() : write(value)) : write;
  fn[flushSymbol] = 1;
  return fn;
};

const setFunctionList = (o, fns) => {
  o.fList = fns;
  o[fListSymbol] = 1;
  return o;
};

const clearFunctionList = o => {
  delete o.fList;
  delete o[fListSymbol];
  return o;
};

class Stop extends Error {}

const toMany = value =>
  value === none ? many([]) : value && value[manySymbol] === 1 ? value : many([value]);

const normalizeMany = o => {
  if (o?.[manySymbol] === 1) {
    switch (o.values.length) {
      case 0:
        return none;
      case 1:
        return o.values[0];
    }
  }
  return o;
};

const combineMany = (a, b) => {
  const values = a === none ? [] : a?.[manySymbol] === 1 ? a.values.slice() : [a];
  if (b === none) {
    // do nothing
  } else if (b?.[manySymbol] === 1) {
    values.push(...b.values);
  } else {
    values.push(b);
  }
  return many(values);
};

const combineManyMut = (a, b) => {
  const values = a === none ? [] : a?.[manySymbol] === 1 ? a.values : [a];
  if (b === none) {
    // do nothing
  } else if (b?.[manySymbol] === 1) {
    values.push(...b.values);
  } else {
    values.push(b);
  }
  return many(values);
};

// old aliases
const final = finalValue;

module.exports.none = none;
module.exports.stop = stop;
module.exports.Stop = Stop;

module.exports.finalSymbol = finalSymbol;
module.exports.finalValue = finalValue;
module.exports.final = final;
module.exports.isFinalValue = isFinalValue;
module.exports.getFinalValue = getFinalValue;

module.exports.manySymbol = manySymbol;
module.exports.many = many;
module.exports.isMany = isMany;
module.exports.getManyValues = getManyValues;
module.exports.getFunctionList = getFunctionList;

module.exports.flushSymbol = flushSymbol;
module.exports.flushable = flushable;
module.exports.isFlushable = isFlushable;

module.exports.fListSymbol = fListSymbol;
module.exports.isFunctionList = isFunctionList;
module.exports.getFunctionList = getFunctionList;
module.exports.setFunctionList = setFunctionList;
module.exports.clearFunctionList = clearFunctionList;

module.exports.toMany = toMany;
module.exports.normalizeMany = normalizeMany;
module.exports.combineMany = combineMany;
module.exports.combineManyMut = combineManyMut;
