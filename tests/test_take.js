'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray, delay} = require('./helpers');

const take = require('../utils/take');
const takeWhile = require('../utils/takeWhile');

unit.add(module, [
  function test_take(t) {
    const async = t.startAsync('test_take');

    const chain = new Chain([take(2)]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeWithSkip(t) {
    const async = t.startAsync('test_takeWithSkip');

    const chain = new Chain([take({n: 2, skip: 2})]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4])'));
      async.done();
    });
  },
  function test_takeWhile(t) {
    const async = t.startAsync('test_takeWhile');

    const chain = new Chain([takeWhile(x => x != 3)]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeWhileAsync(t) {
    const async = t.startAsync('test_takeWhileAsync');

    const chain = new Chain([takeWhile(delay(x => x != 3))]),
      output = [];

    streamFromArray([1, 2, 3, 4, 5]).pipe(chain);

    chain.on('data', value => output.push(value));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  }
]);
