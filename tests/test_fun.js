'use strict';

const unit = require('heya-unit');

const {streamToArray, delay} = require('./helpers');
const chain = require('../src/index');

const fromIterable = require('../src/utils/fromIterable');
const fun = require('../src/fun');

const {none, finalValue, many} = chain;

unit.add(module, [
  function test_fun(t) {
    const async = t.startAsync('test_fun');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), fun(x => x * x, x => 2 * x + 1), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_funFinal(t) {
    const async = t.startAsync('test_funFinal');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        fun(x => x * x, x => finalValue(x), x => 2 * x + 1),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_funNothing(t) {
    const async = t.startAsync('test_funNothing');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), fun(x => x * x, () => none, x => 2 * x + 1), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_funEmpty(t) {
    const async = t.startAsync('test_funEmpty');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), x => x * x, fun(), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_funAsync(t) {
    const async = t.startAsync('test_funAsync');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), fun(delay(x => x * x), x => 2 * x + 1), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_funGenerator(t) {
    const async = t.startAsync('test_funGenerator');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        fun(
          x => x * x,
          function*(x) {
            yield x;
            yield x + 1;
            yield x + 2;
          },
          x => 2 * x + 1
        ),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_funMany(t) {
    const async = t.startAsync('test_funMany');

    const output = [],
      c = chain([
        fromIterable([1, 2, 3]),
        fun(x => x * x, x => many([x, x + 1, x + 2]), x => 2 * x + 1),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_funCombined(t) {
    const async = t.startAsync('test_funCombined');

    const output = [],
      c = chain([
        fromIterable([1, 2]),
        fun(
          delay(x => -x),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield x - 1;
          },
          x => -x
        ),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 10, 11, 2, 3, 20, 21])'));
      async.done();
    });
  },
  function test_funCombinedFinal(t) {
    const async = t.startAsync('test_funCombinedFinal');

    const output = [],
      c = chain([
        fromIterable([1, 2]),
        fun(
          delay(x => -x),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield finalValue(x - 1);
          },
          x => -x
        ),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, -2, 10, -11, 2, -3, 20, -21])'));
      async.done();
    });
  },
  function test_funAsFun(t) {
    const async = t.startAsync('test_funAsFun');

    const output = [],
      c = chain([
        fromIterable([1, 2]),
        fun(
          delay(x => -x),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield finalValue(x - 1);
          },
          x => -x
        ),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, -2, 10, -11, 2, -3, 20, -21])'));
      async.done();
    });
  }
]);
