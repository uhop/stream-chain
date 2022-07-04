'use strict';

const none = Symbol.for('object-stream.none');
const stop = Symbol.for('object-stream.stop');

const finalSymbol = Symbol.for('object-stream.final');
const manySymbol = Symbol.for('object-stream.many');
const flushSymbol = Symbol.for('object-stream.flush');

const finalValue = value => ({[finalSymbol]: 1, value});
const many = values => ({[manySymbol]: 1, values});

const isFinalValue = o => o && o[finalSymbol] === 1;
const isMany = o => o && o[manySymbol] === 1;
const isFlushable = o => o && o[flushSymbol] === 1;

const getFinalValue = value => value.value;
const getManyValues = value => value.values;

const flushable = (write, final = null) => {
  const fn = final ? value => (value === none ? final() : write(value)) : write;
  fn[flushSymbol] = 1;
  return fn;
};

class Stop extends Error {}

// old aliases
const final = finalValue;

module.exports.none = none;
module.exports.stop = stop;
module.exports.Stop = Stop;
module.exports.finalSymbol = finalSymbol;
module.exports.manySymbol = manySymbol;
module.exports.flushSymbol = flushSymbol;
module.exports.finalValue = finalValue;
module.exports.many = many;
module.exports.flushable = flushable;
module.exports.isFinalValue = isFinalValue;
module.exports.isMany = isMany;
module.exports.isFlushable = isFlushable;
module.exports.getFinalValue = getFinalValue;
module.exports.getManyValues = getManyValues;
module.exports.final = final;
