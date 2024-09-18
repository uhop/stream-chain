// @ts-self-types="./index.d.ts"

'use strict';

const {Readable, Writable, Duplex} = require('node:stream');
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

const isReadableWebStream = obj =>
  obj && globalThis.ReadableStream && obj instanceof globalThis.ReadableStream;

const isWritableWebStream = obj =>
  obj && globalThis.WritableStream && obj instanceof globalThis.WritableStream;

const isDuplexWebStream = obj =>
  obj &&
  globalThis.ReadableStream &&
  obj.readable instanceof globalThis.ReadableStream &&
  globalThis.WritableStream &&
  obj.writable instanceof globalThis.WritableStream;

const groupFunctions = (output, fn, index, fns) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    output.push(fn);
    return output;
  }
  if (isDuplexWebStream(fn)) {
    output.push(Duplex.fromWeb(fn, {objectMode: true}));
    return output;
  }
  if (!index && isReadableWebStream(fn)) {
    output.push(Readable.fromWeb(fn, {objectMode: true}));
    return output;
  }
  if (index === fns.length - 1 && isWritableWebStream(fn)) {
    output.push(Writable.fromWeb(fn, {objectMode: true}));
    return output;
  }
  if (typeof fn != 'function')
    throw TypeError('Item #' + index + ' is not a proper stream, nor a function.');
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
  if (isDuplexWebStream(fn)) {
    return Duplex.fromWeb(fn, {objectMode: true});
  }
  if (!index && isReadableWebStream(fn)) {
    return Readable.fromWeb(fn, {objectMode: true});
  }
  if (index === fns.length - 1 && isWritableWebStream(fn)) {
    return Writable.fromWeb(fn, {objectMode: true});
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

  fns = fns.flat(Infinity).filter(fn => fn);

  const streams = (
      options && options.noGrouping
        ? fns.map(wrapFunctions)
        : fns
            .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
            .flat(Infinity)
            .reduce(groupFunctions, [])
            .map(produceStreams)
    ).filter(s => s),
    input = streams[0],
    output = streams.reduce((output, item) => (output && output.pipe(item)) || item);

  let stream = null; // will be assigned later

  let writeMethod = (chunk, encoding, callback) => write(input, chunk, encoding, callback),
    finalMethod = callback => final(input, callback),
    readMethod = () => read(output);

  if (!isWritableNodeStream(input)) {
    writeMethod = (_1, _2, callback) => callback(null);
    finalMethod = callback => callback(null);
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
    Object.assign({writableObjectMode: true, readableObjectMode: true}, options, {
      readable: isReadableNodeStream(output),
      writable: isWritableNodeStream(input),
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

const dataSource = fn => {
  if (typeof fn == 'function') return fn;
  if (fn) {
    if (typeof fn[Symbol.asyncIterator] == 'function') return fn[Symbol.asyncIterator].bind(fn);
    if (typeof fn[Symbol.iterator] == 'function') return fn[Symbol.iterator].bind(fn);
  }
  throw new TypeError('The argument should be a function or an iterable object.');
};

module.exports = chain;

// from defs.js
module.exports.none = defs.none;
module.exports.stop = defs.stop;
module.exports.Stop = defs.Stop;

module.exports.finalSymbol = defs.finalSymbol;
module.exports.finalValue = defs.finalValue;
module.exports.final = defs.final;
module.exports.isFinalValue = defs.isFinalValue;
module.exports.getFinalValue = defs.getFinalValue;

module.exports.manySymbol = defs.manySymbol;
module.exports.many = defs.many;
module.exports.isMany = defs.isMany;
module.exports.getManyValues = defs.getManyValues;
module.exports.getFunctionList = defs.getFunctionList;

module.exports.flushSymbol = defs.flushSymbol;
module.exports.flushable = defs.flushable;
module.exports.isFlushable = defs.isFlushable;

module.exports.fListSymbol = defs.fListSymbol;
module.exports.isFunctionList = defs.isFunctionList;
module.exports.getFunctionList = defs.getFunctionList;
module.exports.setFunctionList = defs.setFunctionList;
module.exports.clearFunctionList = defs.clearFunctionList;

module.exports.chain = chain; // for compatibility with 2.x
module.exports.gen = gen;
module.exports.asStream = asStream;

module.exports.dataSource = dataSource;
