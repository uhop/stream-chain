'use strict';

const unit = require('heya-unit');

const {streamToArray} = require('./helpers');
const Chain = require('../src/index');
const {fromIterable} = require('../src/utils/FromIterable');

const {gen} = Chain;

unit.add(module, [
  function test_transducers(t) {
    const async = t.startAsync('test_transducers');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(
          x => x * x,
          x => 2 * x + 1
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_transducersFinal(t) {
    const async = t.startAsync('test_transducersFinal');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(
          x => x * x,
          x => Chain.finalValue(x),
          x => 2 * x + 1
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_transducersNothing(t) {
    const async = t.startAsync('test_transducersNothing');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(
          x => x * x,
          () => Chain.none,
          x => 2 * x + 1
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_transducersEmpty(t) {
    const async = t.startAsync('test_transducersEmpty');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => x * x, gen(), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_transducersOne(t) {
    const async = t.startAsync('test_transducersOne');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        x => x * x,
        gen(x => 2 * x + 1),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  }
]);
