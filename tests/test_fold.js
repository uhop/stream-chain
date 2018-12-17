'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');

const {fromIterable} = require('../utils/FromIterable');
const fold = require('../utils/fold');
const scan = require('../utils/scan');
const {reduce} = require('../utils/Reduce');

unit.add(module, [
  function test_fold(t) {
    const async = t.startAsync('test_fold');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), fold((acc, x) => acc + x, 0), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldAsync(t) {
    const async = t.startAsync('test_foldAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), fold(delay((acc, x) => acc + x), 0), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldScan(t) {
    const async = t.startAsync('test_foldScan');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), scan((acc, x) => acc + x, 0), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldScanAsync(t) {
    const async = t.startAsync('test_foldScanAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), scan(delay((acc, x) => acc + x), 0), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldReduce(t) {
    const async = t.startAsync('test_foldReduce');

    const r = reduce((acc, x) => acc + x, 0);

    fromIterable([1, 2, 3]).pipe(r);

    r.on('finish', () => {
      eval(t.TEST('t.unify(r.accumulator, 6)'));
      async.done();
    });
  },
  function test_foldReduceAsync(t) {
    const async = t.startAsync('test_foldReduceAsync');

    const r = reduce({reducer: delay((acc, x) => acc + x), initial: 0});

    fromIterable([1, 2, 3]).pipe(r);

    r.on('finish', () => {
      eval(t.TEST('t.unify(r.accumulator, 6)'));
      async.done();
    });
  }
]);
