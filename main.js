'use strict';

const EventEmitter = require('events');
const {Duplex, Transform} = require('stream');

function processData(result, stream) {
  if (result !== undefined && result !== null) {
    if (result instanceof Array) {
      result.forEach(value => value !== undefined && value !== null && stream.push(value));
    } else {
      stream.push(result);
    }
  }
}

class Chain extends EventEmitter {
  constructor(fns, skipEvents) {
    super();

    if (!(fns instanceof Array) || !fns.length) {
      throw Error("Chain's argument should be a non-empty array.");
    }

    this.streams = fns.map(fn => {
      if (typeof fn === 'function') {
        return new Transform({
          objectMode: true,
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
      if (fn instanceof Duplex || fn instanceof Transform) {
        return fn;
      }
      throw Error('Arguments should be functions or streams.');
    });
    this.input = this.streams[0];
    this.output = this.streams.reduce((output, stream) => (output && output.pipe(stream)) || stream);

    // connect events
    if (!skipEvents) {
      this.streams.forEach(stream => stream.on('error', error => this.emit('error', error)));
      this.output.on('data', item => this.emit('data', item));
      this.output.on('end', () => this.emit('end'));
    }
  }
}

module.exports = Chain;
