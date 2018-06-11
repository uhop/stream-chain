'use strict';

const {Readable, Writable, Duplex, Transform} = require('stream');

function processData(result, stream) {
  if (result !== undefined && result !== null) {
    if (result instanceof Array) {
      result.forEach(value => value !== undefined && value !== null && stream.push(value));
    } else {
      stream.push(result);
    }
  }
}

class Chain extends Duplex {
  constructor(fns, options) {
    super(options || {writableObjectMode: true, readableObjectMode: true});

    if (!(fns instanceof Array) || !fns.length) {
      throw Error("Chain's argument should be a non-empty array.");
    }

    this.streams = fns.map((fn, index) => {
      if (typeof fn === 'function') {
        return new Transform({
          writableObjectMode: true,
          readableObjectMode: true,
          transform(chunk, encoding, callback) {
            try {
              const result = fn.call(this, chunk, encoding);
              if (result && typeof result.then == 'function') {
                // Promise
                return result.then(result => (processData(result, this), callback(null)), error => callback(error));
              }
              if (result && typeof result.next == 'function') {
                // generator
                while (true) {
                  const data = result.next();
                  processData(data.value, this);
                  if (data.done) break;
                }
              } else {
                processData(result, this);
              }
              callback(null);
            } catch (error) {
              callback(error);
            }
          }
        });
      }
      if (
        fn instanceof Duplex ||
        fn instanceof Transform ||
        (!index && fn instanceof Readable) ||
        (index === fns.length - 1 && fn instanceof Writable)
      ) {
        return fn;
      }
      throw Error('Arguments should be functions or streams.');
    });
    this.input = this.streams[0];
    this.output = this.streams.reduce((output, stream) => (output && output.pipe(stream)) || stream);

    if (this.input instanceof Writable) {
      this.on('finish', () => this.input.end(null, null)); // for Node 6
    } else {
      this._write = (_1, _2, callback) => callback(null);
      // this._final = callback => callback(null); // unavailable in Node 6
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
  // _final(callback) { // unavailable in Node 6
  //   let error = null;
  //   try {
  //     this.input.end(null, null, e => callback(e || error));
  //   } catch (e) {
  //     error = e;
  //   }
  // }
  _read() {
    this.output.resume();
  }
  static chain(fns, options) {
    return new Chain(fns, options);
  }
}

module.exports = Chain;
