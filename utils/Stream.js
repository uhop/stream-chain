'use strict';

const {Duplex} = require('stream');
const defs = require('../defs');

class Stream extends Duplex {
  constructor(fn, options) {
    super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: true}));
    if (typeof fn != 'function') throw Error('Only function is accepted as the first argument');
    this._fn = fn;
    // pump variables
    this._pause = true;
    this._queue = [];
    this._pending = false;
    this._chunk = this._encoding = this._callback = null;
  }

  _write(chunk, encoding, callback) {
    if (this._pause || this._queue.length) {
      this._pending = true;
      this._chunk = chunk;
      this._encoding = encoding;
      this._callback = callback;
      return;
    }
    this._process(chunk, encoding).then(
      () => callback(null),
      error => callback(error)
    );
  }
  _final(callback) {
    if (this._pause || this._queue.length) {
      this._pending = true;
      this._chunk = this._encoding = null;
      this._callback = callback;
      return;
    }
    this.push(null);
    callback(null);
  }
  _read() {
    this._pause = false;
    this._pump(this).then(() => this._pushPending());
  }

  async _process(chunk, encoding) {
    try {
      const result = this._fn(chunk, encoding);
      if (result && typeof result.then == 'function') {
        // thenable
        return await result.then(result => this._sanitize(result));
      }
      if (result && typeof result.next == 'function') {
        // generator
        this._pushResults(result);
        return await this._pump();
      }
      await this._sanitize(result);
    } catch (error) {
      if (error instanceof defs.Stop) {
        this.push(null);
        this.destroy();
        this._queue = [];
        this._chunk = this._encoding = this._callback = null;
        return;
      }
      throw error;
    }
  }
  async _pump() {
    const queue = this._queue;
    while (!this._pause && queue.length) {
      const gen = queue[queue.length - 1];
      let result = gen.next();
      if (result && typeof result.then == 'function') {
        result = await result;
      }
      if (result.done) {
        queue.pop();
        continue;
      }
      const value = result.value;
      if (value && typeof value.then == 'function') {
        value = await value;
      }
      await this._sanitize(value);
    }
  }
  _pushResults(results) {
    if (results && typeof results.next == 'function') {
      // generator
      this._queue.push(results);
    } else {
      // array
      this._queue.push(results[Symbol.iterator]());
    }
  }
  async _sanitize(result) {
    if (result !== undefined && result !== null && result === defs.none) return;
    if (result === defs.stop) throw new defs.Stop();

    if (defs.isMany(result)) {
      result = defs.getManyValues(result);
      this._pushResults(result);
      return this._pump();
    }

    if (defs.isFinalValue(result)) {
      result = defs.getFinalValue(result);
    }

    this._pause = !this.push(result);
  }
  async _pushPending() {
    if (this._pause || !this._pending) return;
    const chunk = this._chunk,
      encoding = this._encoding,
      callback = this._callback;
    this._pending = false;
    this._chunk = this._encoding = this._callback = null;
    return this._process(chunk, encoding).then(
      () => callback(null),
      error => callback(error)
    );
  }

  static make(fn, options) {
    return new Stream(fn, options);
  }
}

Stream.stream = Stream.make;
Stream.make.Constructor = Stream;

module.exports = Stream;
