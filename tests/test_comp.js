'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');

const {fromIterable} = require('../utils/FromIterable');
const comp = require('../utils/comp');
const asFun = require('../utils/asFun');

const {none, final, many} = Chain;

unit.add(module, [
  function test_comp(t) {
    const async = t.startAsync('test_comp');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), comp(x => x * x, x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_compFinal(t) {
    const async = t.startAsync('test_compFinal');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        comp(x => x * x, x => final(x), x => 2 * x + 1),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_compNothing(t) {
    const async = t.startAsync('test_compNothing');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), comp(x => x * x, () => none, x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_compEmpty(t) {
    const async = t.startAsync('test_compEmpty');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => x * x, comp(), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_compAsync(t) {
    const async = t.startAsync('test_compAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), comp(delay(x => x * x), x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_compGenerator(t) {
    const async = t.startAsync('test_compGenerator');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        comp(
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

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_compMany(t) {
    const async = t.startAsync('test_compMany');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        comp(x => x * x, x => many([x, x + 1, x + 2]), x => 2 * x + 1),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_compCombined(t) {
    const async = t.startAsync('test_compCombined');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        comp(
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

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 10, 11, 2, 3, 20, 21])'));
      async.done();
    });
  },
  function test_compCombinedFinal(t) {
    const async = t.startAsync('test_compCombinedFinal');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        comp(
          delay(x => -x),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield final(x - 1);
          },
          x => -x
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, -2, 10, -11, 2, -3, 20, -21])'));
      async.done();
    });
  },
  function test_compAsFun(t) {
    const async = t.startAsync('test_compAsFun');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        asFun(
          delay(x => -x),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield final(x - 1);
          },
          x => -x
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, -2, 10, -11, 2, -3, 20, -21])'));
      async.done();
    });
  }
]);
