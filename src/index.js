'use strict';

const {Duplex} = require('stream');
const defs = require('./defs');
const gen = require('./gen');
const asStream = require('./asStream');

// is*NodeStream functions taken from https://github.com/nodejs/node/blob/master/lib/internal/streams/utils.js
const isReadableNodeStream = obj =>
  obj &&
  typeof obj.pipe === 'function' &&
  typeof obj.on === 'function' &&
  (!obj._writableState ||
    (typeof obj._readableState === 'object' ? obj._readableState.readable : null) !== false) && // Duplex
  (!obj._writableState || obj._readableState); // Writable has .pipe.

const isWritableNodeStream = obj =>
  obj &&
  typeof obj.write === 'function' &&
  typeof obj.on === 'function' &&
  (!obj._readableState ||
    (typeof obj._writableState === 'object' ? obj._writableState.writable : null) !== false); // Duplex

const isDuplexNodeStream = obj =>
  obj &&
  typeof obj.pipe === 'function' &&
  obj._readableState &&
  typeof obj.on === 'function' &&
  typeof obj.write === 'function';

const groupFunctions = (output, fn, index, fns) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    output.push(fn);
    return output;
  }
  if (typeof fn != 'function') throw TypeError('Item #' + index + ' is not a proper stream, nor a function.');
  if (!output.length) output.push([]);
  const last = output[output.length - 1];
  if (Array.isArray(last)) {
    last.push(fn);
  } else {
    output.push([fn]);
  }
  return output;
};

const produceStreams = item => {
  if (Array.isArray(item)) {
    if (!item.length) return null;
    if (item.length == 1) return item[0] && chain.asStream(item[0]);
    return chain.asStream(chain.gen(...item));
  }
  return item;
};

const wrapFunctions = (fn, index, fns) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    return fn; // an acceptable stream
  }
  if (typeof fn == 'function') return chain.asStream(fn); // a function
  throw TypeError('Item #' + index + ' is not a proper stream, nor a function.');
};

// default implementation of required stream methods

const write = (input, chunk, encoding, callback) => {
  let error = null;
  try {
    input.write(chunk, encoding, e => callback(e || error));
  } catch (e) {
    error = e;
  }
};

const final = (input, callback) => {
  let error = null;
  try {
    input.end(null, null, e => callback(e || error));
  } catch (e) {
    error = e;
  }
};

const read = output => {
  output.resume();
};

// the chain creator

const chain = (fns, options) => {
  if (!Array.isArray(fns) || !fns.length) {
    throw TypeError("Chain's first argument should be a non-empty array.");
  }

  fns = fns.filter(fn => fn).flat(Infinity); // remove nulls and flatten

  const streams = (
      options && options.noGrouping
        ? fns.map(wrapFunctions)
        : fns.reduce(groupFunctions, []).map(produceStreams)
    ).filter(s => s),
    input = streams[0],
    output = streams.reduce((output, item) => (output && output.pipe(item)) || item);

  let stream = null; // will be assigned later

  let writeMethod = (chunk, encoding, callback) => write(input, chunk, encoding, callback),
    finalMethod = callback => final(input, callback),
    readMethod = () => read(output);

  if (!isWritableNodeStream(input)) {
    writeMethod = (_1, _2, callback) => callback(null);
    finalMethod = callback => callback(null); // unavailable in Node 6
    input.on('end', () => stream.end());
  }

  if (isReadableNodeStream(output)) {
    output.on('data', chunk => !stream.push(chunk) && output.pause());
    output.on('end', () => stream.push(null));
  } else {
    readMethod = () => {}; // nop
    output.on('finish', () => stream.push(null));
  }

  stream = new Duplex(
    Object.assign({}, {writableObjectMode: true, readableObjectMode: true}, options, {
      write: writeMethod,
      final: finalMethod,
      read: readMethod
    })
  );
  stream.streams = streams;
  stream.input = input;
  stream.output = output;

  if (!isReadableNodeStream(output)) {
    stream.resume();
  }

  // connect events
  if (!options || !options.skipEvents) {
    streams.forEach(item => item.on('error', error => stream.emit('error', error)));
  }

  return stream;
};

module.exports = chain;

// to keep ESM happy
module.exports.none = chain.none = defs.none;
module.exports.stop = chain.stop = defs.stop;
module.exports.Stop = chain.Stop = defs.Stop;
module.exports.finalSymbol = chain.finalSymbol = defs.finalSymbol;
module.exports.manySymbol = chain.manySymbol = defs.manySymbol;
module.exports.flushSymbol = chain.flushSymbol = defs.flushSymbol;
module.exports.finalValue = chain.finalValue = defs.finalValue;
module.exports.many = chain.many = defs.many;
module.exports.flushable = chain.flushable = defs.flushable;
module.exports.isFinalValue = chain.isFinalValue = defs.isFinalValue;
module.exports.isMany = chain.isMany = defs.isMany;
module.exports.isFlushable = chain.isFlushable = defs.isFlushable;
module.exports.getFinalValue = chain.getFinalValue = defs.getFinalValue;
module.exports.getManyValues = chain.getManyValues = defs.getManyValues;
module.exports.final = chain.final = defs.final;

module.exports.chain = chain.chain = chain; // for compatibility with 2.x
module.exports.gen = chain.gen = gen;
module.exports.asStream = chain.asStream = asStream;
