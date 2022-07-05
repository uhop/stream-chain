'use strict';

const {Readable} = require('stream');
const defs = require('../defs');

class FromIterable extends Readable {
  static resolved = Promise.resolve();

  constructor(options) {
    super(Object.assign({}, {objectMode: true}, options));
    const fn = options && options.iterable;
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
    this._paused = FromIterable.resolved;
    this._resolvePaused = null;
    this._queue = [];

    this._startPump();
  }

  _read() {
    this._resume();
  }

  // pause/resume
  _resume() {
    if (!this._resolvePaused) return;
    this._resolvePaused();
    this._resolvePaused = null;
    this._paused = FromIterable.resolved;
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
  async _startPump() {
    try {
      const value = this._fn();
      await this._processValue(value);
      this.push(null);
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

  static make(iterable) {
    return new FromIterable(
      typeof iterable == 'object' && iterable.iterable ? iterable : {iterable}
    );
  }
}

FromIterable.fromIterable = FromIterable.make;
FromIterable.make.Constructor = FromIterable;

module.exports = FromIterable;

// to keep ESM happy:
module.exports.fromIterable = FromIterable.make;
module.exports.make = FromIterable.make;
