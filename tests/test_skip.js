'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');

const {fromIterable} = require('../utils/FromIterable');
const skip = require('../utils/skip');
const skipWhile = require('../utils/skipWhile');

unit.add(module, [
  function test_skip(t) {
    const async = t.startAsync('test_skip');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3, 4, 5]), skip(2), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  },
  function test_skipWhile(t) {
    const async = t.startAsync('test_skipWhile');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3, 4, 5]), skipWhile(x => x != 3), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  },
  function test_skipWhileAsync(t) {
    const async = t.startAsync('test_skipWhileAsync');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3, 4, 5]), skipWhile(delay(x => x != 3)), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4, 5])'));
      async.done();
    });
  }
]);
