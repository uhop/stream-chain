'use strict';

const unit = require('heya-unit');

const chain = require('../src/index');
const {streamToArray, delay} = require('./helpers');

const fromIterable = require('../src/utils/fromIterable');

unit.add(module, [
  function test_fromIterable(t) {
    const async = t.startAsync('test_fromIterable');

    const output = [],
      c = chain([fromIterable([1, 2, 3]), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 3])'));
      async.done();
    });
  },
  function test_fromIterableFun(t) {
    const async = t.startAsync('test_fromIterableFun');

    const output = [],
      c = chain([fromIterable(() => 0), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [0])'));
      async.done();
    });
  },
  function test_fromIterableAsyncFun(t) {
    const async = t.startAsync('test_fromIterableAsyncFun');

    const output = [],
      c = chain([fromIterable(delay(() => 0)), streamToArray(output)]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [0])'));
      async.done();
    });
  },
  function test_fromIterableGen(t) {
    const async = t.startAsync('test_fromIterableGen');

    const output = [],
      c = chain([
        fromIterable(function* () {
          yield 0;
          yield 1;
        }),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [0, 1])'));
      async.done();
    });
  },
  function test_fromIterableAsyncGen(t) {
    const async = t.startAsync('test_fromIterableAsyncGen');

    const output = [],
      c = chain([
        fromIterable(async function* () {
          yield delay(() => 0)();
          yield delay(() => 1)();
        }),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [0, 1])'));
      async.done();
    });
  },
  function test_fromIterableNextable(t) {
    const async = t.startAsync('test_fromIterableNextable');

    const output = [],
      c = chain([
        fromIterable(
          (function* () {
            yield 0;
            yield 1;
          })()
        ),
        streamToArray(output)
      ]);

    c.on('end', () => {
      eval(t.TEST('t.unify(output, [0, 1])'));
      async.done();
    });
  }
]);
