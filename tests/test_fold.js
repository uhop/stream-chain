'use strict';

const unit = require('heya-unit');

const {streamToArray, delay} = require('./helpers');
const Chain = require('../src/index');

const {fromIterable} = require('../src/utils/FromIterable');
const fold = require('../src/utils/fold');
const scan = require('../src/utils/scan');
const reduce = require('../src/utils/reduce');
const {reduceStream} = require('../src/utils/ReduceStream');

const {asStream} = Chain;

unit.add(module, [
  function test_fold(t) {
    const async = t.startAsync('test_fold');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        fold((acc, x) => acc + x, 0),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldAsync(t) {
    const async = t.startAsync('test_foldAsync');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        fold(
          delay((acc, x) => acc + x),
          0
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldScan(t) {
    const async = t.startAsync('test_foldScan');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        scan((acc, x) => acc + x, 0),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldScanAsync(t) {
    const async = t.startAsync('test_foldScanAsync');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        scan(
          delay((acc, x) => acc + x),
          0
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 3, 6])'));
      async.done();
    });
  },
  function test_foldReduce(t) {
    const async = t.startAsync('test_foldReduce');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        fold((acc, x) => acc + x, 0),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldReduceAsync(t) {
    const async = t.startAsync('test_foldReduceAsync');

    const output = [],
      chain = new Chain([
        fromIterable([1, 2, 3]),
        reduce(
          delay((acc, x) => acc + x),
          0
        ),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [6])'));
      async.done();
    });
  },
  function test_foldReduceStream(t) {
    const async = t.startAsync('test_foldReduceStream');

    const r = reduceStream((acc, x) => acc + x, 0);

    fromIterable([1, 2, 3]).pipe(r);

    r.on('finish', () => {
      eval(t.TEST('t.unify(r.accumulator, 6)'));
      async.done();
    });
  },
  function test_foldReduceStreamAsync(t) {
    const async = t.startAsync('test_foldReduceStreamAsync');

    const r = reduceStream({reducer: delay((acc, x) => acc + x), initial: 0});

    fromIterable([1, 2, 3]).pipe(r);

    r.on('finish', () => {
      eval(t.TEST('t.unify(r.accumulator, 6)'));
      async.done();
    });
  }
]);
