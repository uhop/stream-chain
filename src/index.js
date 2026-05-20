// @ts-self-types="./index.d.ts"

import {Readable, Writable, Duplex} from 'node:stream';
import * as defs from './defs.js';
import gen from './gen.js';
import asStream from './asStream.js';
import asWebStream from './asWebStream.js';

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

const isNodeStream = obj => {
  return (
    obj &&
    (obj._readableState ||
      obj._writableState ||
      (typeof obj.write === 'function' && typeof obj.on === 'function') ||
      (typeof obj.pipe === 'function' && typeof obj.on === 'function'))
  );
};

const isReadableWebStream = obj =>
  !!(
    obj &&
    !isNodeStream(obj) &&
    typeof obj.pipeThrough === 'function' &&
    typeof obj.getReader === 'function' &&
    typeof obj.cancel === 'function'
  );

const isWritableWebStream = obj =>
  !!(
    obj &&
    !isNodeStream(obj) &&
    typeof obj.getWriter === 'function' &&
    typeof obj.abort === 'function'
  );

const isDuplexWebStream = obj =>
  !!(
    obj &&
    !isNodeStream(obj) &&
    typeof obj.readable === 'object' &&
    typeof obj.writable === 'object'
  );

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
    if (item.length == 1) return item[0] && /** @type {any} */ (chain).asStream(item[0]);
    return /** @type {any} */ (chain).asStream(/** @type {any} */ (chain).gen(...item));
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
  if (typeof fn == 'function') return /** @type {any} */ (chain).asStream(fn); // a function
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

  stream = /** @type {Duplex & {streams: any[], input: any, output: any}} */ (
    new Duplex({
      writableObjectMode: true,
      readableObjectMode: true,
      ...options,
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

// from defs.js
chain.none = defs.none;
chain.stop = defs.stop;
chain.Stop = defs.Stop;

chain.finalSymbol = defs.finalSymbol;
chain.finalValue = defs.finalValue;
chain.final = defs.final;
chain.isFinalValue = defs.isFinalValue;
chain.getFinalValue = defs.getFinalValue;

chain.manySymbol = defs.manySymbol;
chain.many = defs.many;
chain.isMany = defs.isMany;
chain.getManyValues = defs.getManyValues;

chain.flushSymbol = defs.flushSymbol;
chain.flushable = defs.flushable;
chain.isFlushable = defs.isFlushable;

chain.fListSymbol = defs.fListSymbol;
chain.isFunctionList = defs.isFunctionList;
chain.getFunctionList = defs.getFunctionList;
chain.setFunctionList = defs.setFunctionList;
chain.clearFunctionList = defs.clearFunctionList;

chain.toMany = defs.toMany;
chain.normalizeMany = defs.normalizeMany;
chain.combineMany = defs.combineMany;
chain.combineManyMut = defs.combineManyMut;

chain.chain = chain; // for compatibility with 2.x
chain.chainUnchecked = chain; // for TypeScript to bypass type checks
chain.gen = gen;
chain.asStream = asStream;
chain.asWebStream = asWebStream;

chain.dataSource = dataSource;

export default chain;
export {chain, chain as chainUnchecked, gen, asStream, asWebStream, dataSource};
export * from './defs.js';
