'use strict';

const EventEmitter = require('events');
const {Duplex, Transform} = require('stream');

function processData(result, stream, callback) {
  if (result !== undefined && result !== null) {
    if (result instanceof Array) {
      result.forEach(value => value !== undefined && value !== null && stream.push(value));
    } else {
      stream.push(result);
    }
  }
  callback && callback(null);
}

class Chain extends EventEmitter {
  constructor(fns, skipEvents) {
    super();

    if (!(fns instanceof Array) || !fns.length) {
      throw Error("Chain's argument should be a non-empty array.");
    }

    this.streams = fns.map((fn, index) => {
      let transform, stream;
      if (typeof fn === 'function') {
        transform = function(chunk, encoding, callback) {
          try {
            const result = fn.call(this, chunk, encoding);
            if (result && typeof result.then == 'function') {
              // Promise
              result.then(result => processData(result, this, callback), error => callback(error));
            } else if (result && typeof result.next == 'function') {
              // generator
              while (true) {
                const data = result.next();
                processData(data.value, this);
                if (data.done) break;
              }
              callback(null);
            } else {
              processData(result, this, callback);
            }
          } catch (error) {
            callback(error);
          }
        };
      } else if (fn instanceof Duplex || fn instanceof Transform) {
        stream = fn;
      } else {
        throw Error('Arguments should be functions or streams.');
      }
      if (!stream) {
        stream = new Transform({objectMode: true, transform});
      }
      !skipEvents && stream.on('error', error => this.emit('error', error));
      return stream;
    });
    this.input = this.streams[0];
    this.output = this.streams.reduce((output, stream) => (output && output.pipe(stream)) || stream);

    // connect events
    if (!skipEvents) {
      this.output.on('data', item => this.emit('data', item));
      this.output.on('end', () => this.emit('end'));
    }
  }
}

module.exports = Chain;
