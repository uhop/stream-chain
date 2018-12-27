'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');

const {fromIterable} = require('../utils/FromIterable');
const gen = require('../utils/gen');
const asGen = require('../utils/asGen');

const {none, final, many} = Chain;

unit.add(module, [
  function test_gen(t) {
    const async = t.startAsync('test_gen');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), gen(x => x * x, x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_genFinal(t) {
    const async = t.startAsync('test_genFinal');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(x => x * x, x => final(x), x => 2 * x + 1),
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
      chain = new Chain([fromIterable([1, 2, 3]), gen(x => x * x, () => none, x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_genEmpty(t) {
    const async = t.startAsync('test_genEmpty');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), x => x * x, gen(), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_genAsync(t) {
    const async = t.startAsync('test_genAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), gen(delay(x => x * x), x => 2 * x + 1), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_genGenerator(t) {
    const async = t.startAsync('test_genGenerator');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(
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
  function test_genMany(t) {
    const async = t.startAsync('test_genMany');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        gen(x => x * x, x => many([x, x + 1, x + 2]), x => 2 * x + 1),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_genCombined(t) {
    const async = t.startAsync('test_genCombined');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        gen(
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
  function test_genCombinedFinal(t) {
    const async = t.startAsync('test_genCombinedFinal');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        gen(
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
  function test_genAsGen(t) {
    const async = t.startAsync('test_genAsGen');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        asGen(
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
  function test_genAsAsyncGen(t) {
    const async = t.startAsync('test_genAsAsyncGen');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2]),
        asGen(
          delay(x => -x),
          x => many([x, x * 10]),
          async function*(x) {
            yield delay(x => x)(x);
            yield delay(x => final(x - 1))(x);
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
