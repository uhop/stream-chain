'use strict';

const {Duplex} = require('stream');
const defs = require('./defs');

class AsStream extends Duplex {
  static resolved = Promise.resolve();

  constructor(fn, options) {
    super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: true}));
    if (typeof fn == 'function') {
      this._fn = fn;
    } else if (fn) {
      if (typeof fn[Symbol.asyncIterator] == 'function') {
        this._fn = fn[Symbol.asyncIterator].bind(fn);
      } else if (typeof fn[Symbol.iterator] == 'function') {
        this._fn = fn[Symbol.iterator].bind(fn);
      }
    }
    if (!this._fn)
      throw TypeError(
        'Only a function or an object with an iterator is accepted as the first argument'
      );

    // pump variables
    this._paused = AsStream.resolved;
    this._resolvePaused = null;
    this._queue = [];
  }

  _write(chunk, encoding, callback) {
    this._processChunk(chunk, encoding).then(
      () => callback(null),
      error => callback(error)
    );
  }
  _final(callback) {
    if (!defs.isFlushable(this._fn)) {
      this.push(null);
      callback(null);
      return;
    }
    this._processChunk(defs.none, null).then(
      () => callback(null),
      error => callback(error)
    );
  }
  _read() {
    this._resume();
  }

  // pause/resume
  _resume() {
    if (!this._resolvePaused) return;
    this._resolvePaused();
    this._resolvePaused = null;
    this._paused = AsStream.resolved;
  }
  _pause() {
    if (this._resolvePaused) return;
    this._paused = new Promise(resolve => (this._resolvePaused = resolve));
  }

  // data processing
  _pushResults(values) {
    if (values && typeof values.next == 'function') {
      // generator
      this._queue.push(values);
      return;
    }
    // array
    this._queue.push(values[Symbol.iterator]());
  }
  async _pump() {
    const queue = this._queue;
    while (queue.length) {
      await this._paused;
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
  async _sanitize(value) {
    if (value === undefined || value === null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();

    if (defs.isMany(value)) {
      this._pushResults(defs.getManyValues(value));
      return this._pump();
    }

    if (defs.isFinalValue(value)) {
      // a final value is not supported, it is treated as a regular value
      value = defs.getFinalValue(value);
      return this._processValue(value);
    }

    if (!this.push(value)) {
      this._pause();
    }
  }
  async _processChunk(chunk, encoding) {
    try {
      const value = this._fn(chunk, encoding);
      await this._processValue(value);
    } catch (error) {
      if (error instanceof defs.Stop) {
        this.push(null);
        this.destroy();
        return;
      }
      throw error;
    }
  }
  async _processValue(value) {
    if (value && typeof value.then == 'function') {
      // thenable
      return value.then(value => this._processValue(value));
    }
    if (value && typeof value.next == 'function') {
      // generator
      this._pushResults(value);
      return this._pump();
    }
    return this._sanitize(value);
  }

  static make(fn, options) {
    return new AsStream(fn, options);
  }
}

AsStream.stream = AsStream.make;
AsStream.make.Constructor = AsStream;

module.exports = AsStream;

// to keep ESM happy:
module.exports.asStream = AsStream.make;
module.exports.make = AsStream.make;
