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
}

class Chain extends Duplex {
  constructor(fns, options) {
    super(options || {writableObjectMode: true, readableObjectMode: true});

    if (!(fns instanceof Array) || !fns.length) {
      throw TypeError("Chain's argument should be a non-empty array.");
    }

    this.streams = fns
      .filter(fn => fn)
      .reduce((output, fn, index, fns) => {
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
          if (!iterator) throw TypeError('Item #' + index + ' is not a proper stream, function, nor iterable.');
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
      }, [])
      .map(item => {
        if (Array.isArray(item)) {
          if (!item.length) return null;
          if (item.length == 1) return item[0] && Chain.asStream(item[0]);
          return Chain.asStream(Chain.gen(...item));
        }
        return item;
      })
      .filter(s => s);
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

Chain.chain = Chain.make;
Chain.make.Constructor = Chain;
Chain.gen = gen;
Chain.asStream = asStream;

module.exports = Chain;

// to keep ESM happy:
module.exports.none = defs.none;
module.exports.stop = defs.stop;
module.exports.Stop = defs.Stop;
module.exports.finalSymbol = defs.finalSymbol;
module.exports.manySymbol = defs.manySymbol;
module.exports.flushSymbol = defs.flushSymbol;
module.exports.finalValue = defs.finalValue;
module.exports.many = defs.many;
module.exports.flushable = defs.flushable;
module.exports.isFinalValue = defs.isFinalValue;
module.exports.isMany = defs.isMany;
module.exports.isFlushable = defs.isFlushable;
module.exports.getFinalValue = defs.getFinalValue;
module.exports.getManyValues = defs.getManyValues;
module.exports.final = defs.final;

module.exports.chain = Chain.make;
module.exports.gen = gen;
module.exports.asStream = asStream;
