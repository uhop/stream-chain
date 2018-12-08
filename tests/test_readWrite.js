'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, streamToArray} = require('./helpers');

unit.add(module, [
  function test_readWriteReadable(t) {
    const async = t.startAsync('test_readWriteReadable');

    const output1 = [],
      output2 = [],
      chain = new Chain([streamFromArray([1, 2, 3]), x => x * x]);

    chain.pipe(streamToArray(output1));

    chain.on('data', value => output2.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      eval(t.TEST('t.unify(output2, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteWritable(t) {
    const async = t.startAsync('test_readWriteWritable');

    const output1 = [],
      chain = new Chain([x => x * x, streamToArray(output1)]);

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteReadableWritable(t) {
    const async = t.startAsync('test_readWriteReadableWritable');

    const output1 = [],
      chain = new Chain([streamFromArray([1, 2, 3]), x => x * x, streamToArray(output1)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 4, 9])'));
      async.done();
    });
  },
  function test_readWriteSingleReadable(t) {
    const async = t.startAsync('test_readWriteSingleReadable');

    const output1 = [],
      output2 = [],
      chain = new Chain([streamFromArray([1, 2, 3])]);

    chain.pipe(streamToArray(output1));

    chain.on('data', value => output2.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 2, 3])'));
      eval(t.TEST('t.unify(output2, [1, 2, 3])'));
      async.done();
    });
  },
  function test_readWriteSingleWritable(t) {
    const async = t.startAsync('test_readWriteSingleWritable');

    const output1 = [],
      chain = new Chain([streamToArray(output1)]);

    streamFromArray([1, 2, 3]).pipe(chain);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 2, 3])'));
      async.done();
    });
  },
  function test_readWritePipeable(t) {
    const async = t.startAsync('test_readWritePipeable');

    const output1 = [],
      output2 = [],
      chain = new Chain([streamFromArray([1, 2, 3]), streamToArray(output1)]);

    streamFromArray([4, 5, 6])
      .pipe(chain)
      .pipe(streamToArray(output2));

    chain.on('end', () => {
      eval(t.TEST('t.unify(output1, [1, 2, 3])'));
      eval(t.TEST('t.unify(output2, [])'));
      async.done();
    });
  }
]);
