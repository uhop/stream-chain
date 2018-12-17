'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');
const {fromIterable} = require('../utils/FromIterable');
const {Transform} = require('stream');

unit.add(module, [
  function test_simpleGeneric(t) {
    const async = t.startAsync('test_simpleGeneric');

    const chain = new Chain([x => x * x]),
      output1 = [],
      output2 = [];

    fromIterable([1, 2, 3])
      .pipe(chain)
      .pipe(streamToArray(output1));

    chain.on('data', value => output2.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      eval(t.TEST('t.unify(output2, [1, 4, 9])'));
      async.done();
    });
  },
  function test_simpleGenerator(t) {
    const async = t.startAsync('test_simpleGenerator');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        function*(x) {
          yield x * x;
          yield x * x * x;
          yield 2 * x;
        },
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleAsync(t) {
    const async = t.startAsync('test_simpleAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), delay(x => x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [2, 3, 4])'));
      async.done();
    });
  },
  function test_simpleArray(t) {
    const async = t.startAsync('test_simpleArray');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => [x * x, x * x * x, 2 * x], streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleMany(t) {
    const async = t.startAsync('test_simpleMany');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => Chain.many([x * x, x * x * x, 2 * x]), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleChain(t) {
    const async = t.startAsync('test_simpleChain');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => x * x, x => 2 * x + 1, streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleStream(t) {
    const async = t.startAsync('test_simpleStream');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        new Transform({
          objectMode: true,
          transform(x, _, callback) {
            callback(null, x * x);
          }
        }),
        x => 2 * x + 1,
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleFactory(t) {
    const async = t.startAsync('test_simpleChain');

    const output = [],
      chain = Chain.chain([fromIterable([1, 2, 3]), x => x * x, x => 2 * x + 1, streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  }
]);
