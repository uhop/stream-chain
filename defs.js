'use strict';

const none = Symbol.for('object-stream.none');
const finalSymbol = Symbol.for('object-stream.final');
const manySymbol = Symbol.for('object-stream.many');

const finalValue = value => ({[finalSymbol]: value});
const many = values => ({[manySymbol]: values});

const isFinalValue = o => o && typeof o == 'object' && finalSymbol in o;
const isMany = o => o && typeof o == 'object' && manySymbol in o;

const getFinalValue = o => o[finalSymbol];
const getManyValues = o => o[manySymbol];

class Stop {}

module.exports.none = none;
module.exports.finalValue = finalValue;
module.exports.isFinalValue = isFinalValue;
module.exports.getFinalValue = getFinalValue;
module.exports.many = many;
module.exports.isMany = isMany;
module.exports.getManyValues = getManyValues;
module.exports.Stop = Stop;
