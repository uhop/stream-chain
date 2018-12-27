'use strict';

const {Readable, Writable, Duplex, Transform} = require('stream');
const {none, Final, Many, final, many} = require('./defs');

const runAsyncGenerator = async (gen, stream) => {
  for (;;) {
    let data = gen.next();
    if (data && typeof data.then == 'function') {
      data = await data;
    }
    if (data.done) break;
    const value = data.value;
    if (value && typeof value.then == 'function') {
      value = await value;
    }
    Chain.sanitize(value, stream);
  }
};

const wrapFunction = fn =>
  new Transform({
    writableObjectMode: true,
    readableObjectMode: true,
    transform(chunk, encoding, callback) {
      try {
        const result = fn.call(this, chunk, encoding);
        if (result && typeof result.then == 'function') {
          // thenable
          result.then(result => (Chain.sanitize(result, this), callback(null)), error => callback(error));
          return;
        }
        if (result && typeof result.next == 'function') {
          // generator
          runAsyncGenerator(result, this).then(() => callback(null), error => callback(error));
          return;
        }
        Chain.sanitize(result, this);
        callback(null);
      } catch (error) {
        callback(error);
      }
    }
  });

const wrapArray = fns =>
  new Transform({
    writableObjectMode: true,
    readableObjectMode: true,
    transform(chunk, encoding, callback) {
      try {
        let value = chunk;
        for (let i = 0; i < fns.length; ++i) {
          const result = fns[i].call(this, value, encoding);
          if (result === Chain.none) {
            callback(null);
            return;
          }
          if (result instanceof Chain.Final) {
            value = result.value;
            break;
          }
          value = result;
        }
        Chain.sanitize(value, this);
        callback(null);
      } catch (error) {
        callback(error);
      }
    }
  });

class Chain extends Duplex {
  constructor(fns, options) {
    super(options || {writableObjectMode: true, readableObjectMode: true});

    if (!(fns instanceof Array) || !fns.length) {
      throw Error("Chain's argument should be a non-empty array.");
    }

    this.streams = fns
      .filter(fn => fn)
      .map((fn, index, fns) => {
        if (typeof fn === 'function' || fn instanceof Array) return Chain.convertToTransform(fn);
        if (
          fn instanceof Duplex ||
          fn instanceof Transform ||
          (!index && fn instanceof Readable) ||
          (index === fns.length - 1 && fn instanceof Writable)
        ) {
          return fn;
        }
        throw Error('Arguments should be functions, arrays or streams.');
      })
      .filter(s => s);
    this.input = this.streams[0];
    this.output = this.streams.reduce((output, stream) => (output && output.pipe(stream)) || stream);

    if (!(this.input instanceof Writable)) {
      this._write = (_1, _2, callback) => callback(null);
      this._final = callback => callback(null); // unavailable in Node 6
      this.input.on('end', () => this.end());
    }

    if (this.output instanceof Readable) {
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
  static sanitize(result, stream) {
    if (result instanceof Chain.Final) {
      result = result.value;
    } else if (result instanceof Chain.Many) {
      result = result.values;
    }
    if (result !== undefined && result !== null && result !== Chain.none) {
      if (result instanceof Array) {
        result.forEach(value => value !== undefined && value !== null && stream.push(value));
      } else {
        stream.push(result);
      }
    }
  }
  static convertToTransform(fn) {
    if (typeof fn === 'function') return wrapFunction(fn);
    if (fn instanceof Array) return fn.length ? wrapArray(fn) : null;
    return null;
  }
}

Chain.none = none;
Chain.Final = Final;
Chain.final = final;
Chain.Many = Many;
Chain.many = many;

Chain.chain = Chain.make;
Chain.make.Constructor = Chain;

module.exports = Chain;
