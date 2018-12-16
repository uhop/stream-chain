'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, delay} = require('./helpers');

const fold = require('../utils/fold');
const scan = require('../utils/scan');
const Reduce = require('../utils/Reduce');

unit.add(module, [
  function test_fold(t) {
    const async = t.startAsync('test_fold');

    const chain = new Chain([fold((acc, x) => acc + x, 0)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldAsync(t) {
    const async = t.startAsync('test_foldAsync');

    const chain = new Chain([fold(delay((acc, x) => acc + x), 0)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldScan(t) {
    const async = t.startAsync('test_foldScan');

    const chain = new Chain([scan((acc, x) => acc + x, 0)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldScanAsync(t) {
    const async = t.startAsync('test_foldScanAsync');

    const chain = new Chain([scan(delay((acc, x) => acc + x), 0)]),
      output = [];

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldReduce(t) {
    const async = t.startAsync('test_foldReduce');

    const reduce = new Reduce({reducer: (acc, x) => acc + x, initial: 0});

    streamFromArray([1, 2, 3]).pipe(reduce);

    reduce.on('finish', () => {
      eval(t.TEST('t.unify(reduce.accumulator, 6)'));
      async.done();
    });
  },
  function test_foldReduceAsync(t) {
    const async = t.startAsync('test_foldReduceAsync');

    const reduce = new Reduce({reducer: delay((acc, x) => acc + x), initial: 0});

    streamFromArray([1, 2, 3]).pipe(reduce);

    reduce.on('finish', () => {
      eval(t.TEST('t.unify(reduce.accumulator, 6)'));
      async.done();
    });
  }
]);
