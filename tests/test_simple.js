'use strict';

const unit = require('heya-unit');

const {Transform} = require('stream');
const {streamToArray, delay} = require('./helpers');
const chain = require('../src/index');
const {fromIterable} = require('../src/utils/FromIterable');

unit.add(module, [
  function test_simpleGeneric(t) {
    const async = t.startAsync('test_simpleGeneric');

    const c = chain([x => x * x]),
      output1 = [],
      output2 = [];

    fromIterable([1, 2, 3]).pipe(c).pipe(streamToArray(output1));

    c.on('data', value => output2.push(value));
    c.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      eval(t.TEST('t.unify(output2, [1, 4, 9])'));
      async.done();
    });
  },
  function test_simpleGenerator(t) {
    const async = t.startAsync('test_simpleGenerator');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        function* (x) {
          yield x * x;
          yield x * x * x;
          yield 2 * x;
        },
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleAsync(t) {
    const async = t.startAsync('test_simpleAsync');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), delay(x => x + 1), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [2, 3, 4])'));
      async.done();
    });
  },
  function test_simpleMany(t) {
    const async = t.startAsync('test_simpleMany');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        x => chain.many([x * x, x * x * x, 2 * x]),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleChain(t) {
    const async = t.startAsync('test_simpleChain');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        x => x * x,
        x => 2 * x + 1,
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleStream(t) {
    const async = t.startAsync('test_simpleStream');

    const output = [],
      c = chain([
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

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleFactory(t) {
    const async = t.startAsync('test_simpleChain');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        x => x * x,
        x => 2 * x + 1,
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleIterable(t) {
    const async = t.startAsync('test_simpleIterable');

    const output = [],
      c = chain([
        [1, 2, 3],
        function* (x) {
          yield x * x;
          yield x * x * x;
          yield 2 * x;
        },
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });

    c.end(0); // start the chain
  }
]);
