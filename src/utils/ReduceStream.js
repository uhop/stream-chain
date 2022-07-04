'use strict';

const {Writable} = require('stream');

const defaultInitial = 0;
const defaultReducer = (acc, value) => value;

class ReduceStream extends Writable {
  constructor(options) {
    super(Object.assign({}, options, {objectMode: true}));
    this.accumulator = defaultInitial;
    this._reducer = defaultReducer;
    if (options) {
      'initial' in options && (this.accumulator = options.initial);
      'reducer' in options && (this._reducer = options.reducer);
    }
  }
  _write(chunk, encoding, callback) {
    const result = this._reducer.call(this, this.accumulator, chunk);
    if (result && typeof result.then == 'function') {
      result.then(
        value => {
          this.accumulator = value;
          callback(null);
        },
        error => callback(error)
      );
    } else {
      this.accumulator = result;
      callback(null);
    }
  }
  static make(reducer, initial) {
    return new ReduceStream(typeof reducer == 'object' ? reducer : {reducer, initial});
  }
}
ReduceStream.reduceStream = ReduceStream.make;
ReduceStream.make.Constructor = ReduceStream;

module.exports = ReduceStream;

// to keep ESM happy:
module.exports.reduceStream = ReduceStream.make;
module.exports.make = ReduceStream.make;
