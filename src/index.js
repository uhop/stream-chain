'use strict';

const {Duplex} = require('stream');
const defs = require('./defs');
const gen = require('./gen');
const {asStream} = require('./AsStream');

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

const getIterator = x => {
  if (!x) return null;
  if (typeof x[Symbol.asyncIterator] == 'function') return x[Symbol.asyncIterator].bind(x);
  if (typeof x[Symbol.iterator] == 'function') return x[Symbol.iterator].bind(x);
  return null;
};

const groupFunctions = (output, fn, index, fns) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    output.push(fn);
    return output;
  }
  if (typeof fn != 'function') {
    const iterator = getIterator(fn);
    if (!iterator)
      throw TypeError('Item #' + index + ' is not a proper stream, function, nor iterable.');
    fn = iterator;
  }
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
  const iterator = getIterator(fn);
  if (!iterator)
    throw TypeError('Item #' + index + ' is not a proper stream, function, nor iterable.');
  return chain.asStream(iterator);
};

let chain = null; // will be assigned later

class Chain extends Duplex {
  constructor(fns, options) {
    super(Object.assign({}, {writableObjectMode: true, readableObjectMode: true}, options));

    if (!(fns instanceof Array) || !fns.length) {
      throw TypeError("Chain's argument should be a non-empty array.");
    }

    fns = fns.filter(fn => fn); // remove nulls

    this.streams = (
      options && options.noGrouping
        ? fns.reduce(groupFunctions, []).map(produceStreams)
        : fns.map(wrapFunctions)
    ).filter(s => s);
    this.input = this.streams[0];
    this.output = this.streams.reduce(
      (output, stream) => (output && output.pipe(stream)) || stream
    );

    if (!isWritableNodeStream(this.input)) {
      this._write = (_1, _2, callback) => callback(null);
      this._final = callback => callback(null); // unavailable in Node 6
      this.input.on('end', () => this.end());
    }

    if (isReadableNodeStream(this.output)) {
      this.output.on('data', chunk => !this.push(chunk) && this.output.pause());
      this.output.on('end', () => this.push(null));
    } else {
      this._read = () => {}; // nop
      this.resume();
      this.output.on('finish', () => this.push(null));
    }

    // connect events
    if (!options || !options.skipEvents) {
      this.streams.forEach(stream => stream.on('error', error => this.emit('error', error)));
    }
  }
  _write(chunk, encoding, callback) {
    let error = null;
    try {
      this.input.write(chunk, encoding, e => callback(e || error));
    } catch (e) {
      error = e;
    }
  }
  _final(callback) {
    let error = null;
    try {
      this.input.end(null, null, e => callback(e || error));
    } catch (e) {
      error = e;
    }
  }
  _read() {
    this.output.resume();
  }
  static make(fns, options) {
    return new Chain(fns, options);
  }
}

Chain.make.Constructor = Chain;

chain = Chain.make;

module.exports = chain;

// to keep ESM happy:
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
module.exports.make = chain.make = Chain.make;

module.exports.chain = chain.chain = chain; // for compatibility with 2.x
module.exports.Chain = chain.Chain = Chain;
module.exports.gen = chain.gen = gen;
module.exports.asStream = chain.asStream = asStream;
