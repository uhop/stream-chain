const {Writable} = require('stream');

const defaultInitial = 0;
const defaultReducer = (acc, value) => value;

class Reduce extends Writable {
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
    this.accumulator = this._reducer.call(this, this.accumulator, chunk);
    callback(null);
  }
  _writev(chunks, callback) {
    chunks.forEach(item => (this.accumulator = this._reducer.call(this, this.accumulator, item.chunk)));
    callback(null);
  }
  static make(reducer, initial) {
    return new Reduce(typeof reducer == 'object' ? reducer : {reducer, initial});
  }
}
Reduce.reduce = Reduce.make;
Reduce.make.Constructor = Reduce;

module.exports = Reduce;
