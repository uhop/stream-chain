'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, streamToArray} = require('./helpers');
const {Transform} = require('stream');

unit.add(module, [
  function test_transducers(t) {
    const async = t.startAsync('test_transducers');

    const chain = new Chain([[x => x * x, x => 2 * x + 1]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_transducersFinal(t) {
    const async = t.startAsync('test_transducersFinal');

    const chain = new Chain([[x => x * x, x => Chain.final(x), x => 2 * x + 1]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_transducersNothing(t) {
    const async = t.startAsync('test_transducersNothing');

    const chain = new Chain([[x => x * x, () => Chain.final(), x => 2 * x + 1]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_transducersEmpty(t) {
    const async = t.startAsync('test_transducersEmpty');

    const chain = new Chain([x => x * x, []]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_transducersOne(t) {
    const async = t.startAsync('test_transducersOne');

    const chain = new Chain([x => x * x, [x => 2 * x + 1]]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  }
]);
