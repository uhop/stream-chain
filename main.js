'use strict';

const EventEmitter = require('events');
const {Transform} = require('stream');

const GeneratorFunction = Object.getPrototypeOf(function*() {}).constructor;
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;

function processData(result, stream, callback) {
  if (result !== undefined) {
    if (result instanceof Array) {
      result.forEach(value => value !== undefined && stream.push(value));
    } else {
      stream.push(result);
    }
  }
  callback && callback();
}

class Chain extends EventEmitter {
  constructor(fns, skipEvents) {
    super();

    if (!(fns instanceof Array) || !fns.length) {
      throw Error("Chain's argument should be a non-empty array.");
    }

    this.streams = fns.map((fn, index) => {
      let transform;
      if (fn instanceof AsyncFunction) {
        transform = function(chunk, encoding, callback) {
          fn.call(this, chunk, encoding).then(result => processData(result, this, callback), error => callback(error));
        };
      } else if (fn instanceof GeneratorFunction) {
        transform = function(chunk, encoding, callback) {
          try {
            const generator = fn(chunk, encoding);
            while (true) {
              const result = generator.next();
              processData(result.value, this);
              if (result.done) break;
            }
            callback();
          } catch (error) {
            callback(error);
          }
        };
      } else if (typeof fn === 'function') {
        transform = function(chunk, encoding, callback) {
          try {
            const result = fn.call(this, chunk, encoding);
            processData(result, this, callback);
          } catch (error) {
            callback(error);
          }
        };
      } else {
        throw Error('Arguments should be functions.');
      }
      const stream = new Transform({objectMode: true, transform});
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
