'use strict';

const unit = require('heya-unit');

const {streamToArray} = require('./helpers');
const chain = require('../src/index');
const fromIterable = require('../src/utils/fromIterable');

unit.add(module, [
  function test_readWriteReadable(t) {
    const async = t.startAsync('test_readWriteReadable');

    const output1 = [],
      output2 = [],
      c = chain([fromIterable([1, 2, 3]), x => x * x]);

    c.pipe(streamToArray(output1));

    c.on('data', value => output2.push(value));
    c.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      eval(t.TEST('t.unify(output2, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteWritable(t) {
    const async = t.startAsync('test_readWriteWritable');

    const output = [],
      c = chain([x => x * x, streamToArray(output)]);

    fromIterable([1, 2, 3]).pipe(c);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteReadableWritable(t) {
    const async = t.startAsync('test_readWriteReadableWritable');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), x => x * x, streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteSingleReadable(t) {
    const async = t.startAsync('test_readWriteSingleReadable');

    const output1 = [],
      output2 = [],
      c = chain([fromIterable([1, 2, 3])]);

    c.pipe(streamToArray(output1));

    c.on('data', value => output2.push(value));
    c.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 2, 3])'));
      eval(t.TEST('t.unify(output2, [1, 2, 3])'));
      async.done();
    });
  },
  function test_readWriteSingleWritable(t) {
    const async = t.startAsync('test_readWriteSingleWritable');

    const output = [],
      c = chain([streamToArray(output)]);

    fromIterable([1, 2, 3]).pipe(c);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 3])'));
      async.done();
    });
  },
  function test_readWritePipeable(t) {
    const async = t.startAsync('test_readWritePipeable');

    const output1 = [],
      output2 = [],
      c = chain([fromIterable([1, 2, 3]), streamToArray(output1)]);

    fromIterable([4, 5, 6])
      .pipe(c)
      .pipe(streamToArray(output2));

    c.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 2, 3])'));
      eval(t.TEST('t.unify(output2, [])'));
      async.done();
    });
  }
]);
