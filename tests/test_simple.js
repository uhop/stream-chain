'use strict';

const unit = require('heya-unit');

const Chain = require('../main');
const {streamFromArray, streamToArray} = require('./helper');
const {Transform} = require('stream');

unit.add(module, [
  function test_simple(t) {
    const async = t.startAsync('test_simple');

    const chain = new Chain([x => x * x]),
      output1 = [],
      output2 = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);
    chain.output.pipe(streamToArray(output1));

    chain.on('data', value => output2.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      eval(t.TEST('t.unify(output2, [1, 4, 9])'));
      async.done();
    });
  },
  function test_gen(t) {
    const async = t.startAsync('test_gen');

    const chain = new Chain([
        function*(x) {
          yield x * x;
          yield x * x * x;
          return 2 * x;
        }
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_async(t) {
    const async = t.startAsync('test_async');

    const chain = new Chain([
        async x =>
          new Promise(resolve => {
            setTimeout(() => resolve(x + 1), 20);
          })
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [2, 3, 4])'));
      async.done();
    });
  },
  function test_array(t) {
    const async = t.startAsync('test_array');

    const chain = new Chain([x => [x * x, x * x * x, 2 * x]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_chain(t) {
    const async = t.startAsync('test_chain');

    const chain = new Chain([x => x * x, x => 2 * x + 1]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_stream(t) {
    const async = t.startAsync('test_stream');

    const chain = new Chain([
        new Transform({
          objectMode: true,
          transform(x, _, callback) {
            callback(null, x * x);
          }
        }),
        x => 2 * x + 1
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain.input);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  }
]);
