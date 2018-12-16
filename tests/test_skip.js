'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, delay} = require('./helpers');

const skip = require('../utils/skip');
const skipWhile = require('../utils/skipWhile');

unit.add(module, [
  function test_skip(t) {
    const async = t.startAsync('test_skip');

    const chain = new Chain([skip(2)]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  },
  function test_skipWhile(t) {
    const async = t.startAsync('test_skipWhile');

    const chain = new Chain([skipWhile(x => x != 3)]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  },
  function test_skipWhileAsync(t) {
    const async = t.startAsync('test_skipWhileAsync');

    const chain = new Chain([skipWhile(delay(x => x != 3))]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  }
]);
