'use strict';

const unit = require('heya-unit');

const {streamToArray, delay} = require('./helpers');
const chain = require('../src/index');

const {fromIterable} = require('../src/utils/FromIterable');
const take = require('../src/utils/take');
const takeWhile = require('../src/utils/takeWhile');
const takeWithSkip = require('../src/utils/takeWithSkip');

const {stop} = chain;

unit.add(module, [
  function test_take(t) {
    const async = t.startAsync('test_take');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), take(2), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeWithSkip(t) {
    const async = t.startAsync('test_takeWithSkip');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), takeWithSkip(2, 2), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4])'));
      async.done();
    });
  },
  function test_takeWhile(t) {
    const async = t.startAsync('test_takeWhile');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), takeWhile(x => x != 3), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeWhileAsync(t) {
    const async = t.startAsync('test_takeWhileAsync');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), takeWhile(delay(x => x != 3)), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeStop(t) {
    const async = t.startAsync('test_takeStop');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), take(2, stop), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2])'));
      async.done();
    });
  },
  function test_takeStopWithSkip(t) {
    const async = t.startAsync('test_takeStopWithSkip');

    const output = [],
      c = chain([fromIterable([1, 2, 3, 4, 5]), takeWithSkip(2, 2, stop), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [3, 4])'));
      async.done();
    });
  }
]);
