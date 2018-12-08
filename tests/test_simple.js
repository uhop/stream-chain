'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, streamToArray} = require('./helpers');
const {Transform} = require('stream');

unit.add(module, [
  function test_simpleGeneric(t) {
    const async = t.startAsync('test_simpleGeneric');

    const chain = new Chain([x => x * x]),
      output1 = [],
      output2 = [];

    streamFromArray([1, 2, 3])
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

    const chain = new Chain([
        function*(x) {
          yield x * x;
          yield x * x * x;
          return 2 * x;
        }
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleAsync(t) {
    const async = t.startAsync('test_simpleAsync');

    const chain = new Chain([
        async x =>
          await new Promise(resolve => {
            setTimeout(() => resolve(x + 1), 20);
          })
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [2, 3, 4])'));
      async.done();
    });
  },
  function test_simpleArray(t) {
    const async = t.startAsync('test_simpleArray');

    const chain = new Chain([x => [x * x, x * x * x, 2 * x]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleMany(t) {
    const async = t.startAsync('test_simpleMany');

    const chain = new Chain([x => Chain.many([x * x, x * x * x, 2 * x])]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 1, 2, 4, 8, 4, 9, 27, 6])'));
      async.done();
    });
  },
  function test_simpleChain(t) {
    const async = t.startAsync('test_simpleChain');

    const chain = new Chain([x => x * x, x => 2 * x + 1]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleStream(t) {
    const async = t.startAsync('test_simpleStream');

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

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_simpleFactory(t) {
    const async = t.startAsync('test_simpleChain');

    const chain = Chain.chain([x => x * x, x => 2 * x + 1]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  }
]);
