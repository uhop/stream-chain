'use strict';

const {Transform} = require('stream');

const alwaysFalse = () => false;

class SkipWhile extends Transform {
  constructor(options) {
    super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: true}));
    this._condition = alwaysFalse;
    if (options) {
      'condition' in options && (this._condition = options.condition);
    }
  }
  _transform(chunk, encoding, callback) {
    if (!this._condition.call(this, chunk)) {
      this._transform = this._passThrough;
      this.push(chunk);
    }
    callback(null);
  }
  _passThrough(chunk, encoding, callback) {
    this.push(chunk);
    callback(null);
  }
  static make(condition) {
    return new SkipWhile(typeof condition == 'object' ? condition : {condition});
  }
}
SkipWhile.make.Constructor = SkipWhile;

module.exports = SkipWhile.make;
