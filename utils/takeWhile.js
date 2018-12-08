'use strict';

const {Transform} = require('stream');

const alwaysTrue = () => true;

class TakeWhile extends Transform {
  constructor(options) {
    super(Object.assign({}, options, {writableObjectMode: true, readableObjectMode: true}));
    this._condition = alwaysTrue;
    if (options) {
      'condition' in options && (this._condition = options.condition);
    }
  }
  _transform(chunk, encoding, callback) {
    if (this._condition.call(this, chunk)) {
      this.push(chunk);
    } else {
      this._transform = this._doNothing;
    }
    callback(null);
  }
  _doNothing(chunk, encoding, callback) {
    callback(null);
  }
  static make(condition) {
    return new TakeWhile(typeof condition == 'object' ? condition : {condition});
  }
}
TakeWhile.make.Constructor = TakeWhile;


module.exports = TakeWhile.make;
