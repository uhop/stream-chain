'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray} = require('./helpers');

const comp = require('../utils/comp');

const {final, many} = Chain;
const none = final();

unit.add(module, [
  function test_comp(t) {
    const async = t.startAsync('test_comp');

    const chain = new Chain([comp(x => x * x, x => 2 * x + 1)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_compFinal(t) {
    const async = t.startAsync('test_compFinal');

    const chain = new Chain([comp(x => x * x, x => final(x), x => 2 * x + 1)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_compNothing(t) {
    const async = t.startAsync('test_compNothing');

    const chain = new Chain([comp(x => x * x, () => final(), x => 2 * x + 1)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [])'));
      async.done();
    });
  },
  function test_compEmpty(t) {
    const async = t.startAsync('test_compEmpty');

    const chain = new Chain([x => x * x, comp()]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_compAsync(t) {
    const async = t.startAsync('test_compAsync');

    const chain = new Chain([
        comp(
          async x =>
            await new Promise(resolve => {
              setTimeout(() => resolve(x * x), 20);
            }),
          x => 2 * x + 1
        )
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 9, 19])'));
      async.done();
    });
  },
  function test_compGenerator(t) {
    const async = t.startAsync('test_compGenerator');

    const chain = new Chain([
        comp(
          x => x * x,
          function*(x) {
            yield x;
            yield x + 1;
            yield x + 2;
          },
          x => 2 * x + 1
        )
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_compMany(t) {
    const async = t.startAsync('test_compMany');

    const chain = new Chain([
        comp(
          x => x * x,
          x => many([x, x + 1, x + 2]),
          x => 2 * x + 1
        )
      ]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 5, 7, 9, 11, 13, 19, 21, 23])'));
      async.done();
    });
  },
  function test_compCombined(t) {
    const async = t.startAsync('test_compCombined');

    const chain = new Chain([
        comp(
          async x =>
            await new Promise(resolve => {
              setTimeout(() => resolve(-x), 20);
            }),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield x - 1;
          },
          x => -x
        )
      ]),
      output = [];

    streamFromArray([1, 2]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 10, 11, 2, 3, 20, 21])'));
      async.done();
    });
  },
  function test_compCombinedFinal(t) {
    const async = t.startAsync('test_compCombinedFinal');

    const chain = new Chain([
        comp(
          async x =>
            await new Promise(resolve => {
              setTimeout(() => resolve(-x), 20);
            }),
          x => many([x, x * 10]),
          function*(x) {
            yield x;
            yield final(x - 1);
          },
          x => -x
        )
      ]),
      output = [];

    streamFromArray([1, 2]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, -2, 10, -11, 2, -3, 20, -21])'));
      async.done();
    });
  }
]);
