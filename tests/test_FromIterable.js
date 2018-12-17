'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamToArray, delay} = require('./helpers');

const {fromIterable} = require('../utils/FromIterable');

unit.add(module, [
  function test_FromIterable(t) {
    const async = t.startAsync('test_FromIterable');

    const output = [],
      chain = new Chain([fromIterable([1, 2, 3]), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [1, 2, 3])'));
      async.done();
    });
  },
  function test_FromIterableFun(t) {
    const async = t.startAsync('test_FromIterableFun');

    const output = [],
      chain = new Chain([fromIterable(() => 0), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [0])'));
      async.done();
    });
  },
  function test_FromIterableAsyncFun(t) {
    const async = t.startAsync('test_FromIterableAsyncFun');

    const output = [],
      chain = new Chain([fromIterable(delay(() => 0)), streamToArray(output)]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [0])'));
      async.done();
    });
  },
  function test_FromIterableGen(t) {
    const async = t.startAsync('test_FromIterableGen');

    const output = [],
      chain = new Chain([
        fromIterable(function*() {
          yield 0;
          yield 1;
        }),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [0, 1])'));
      async.done();
    });
  },
  // function test_FromIterableAsyncGen(t) {
  //   const async = t.startAsync('test_FromIterableAsyncGen');

  //   const output = [],
  //     chain = new Chain([
  //       fromIterable(async function*() {
  //         yield delay(() => 0)();
  //         yield delay(() => 1)();
  //       }),
  //       streamToArray(output)
  //     ]);

  //   chain.on('end', () => {
  //     eval(t.TEST('t.unify(output, [0, 1])'));
  //     async.done();
  //   });
  // },
  function test_FromIterableNextable(t) {
    const async = t.startAsync('test_FromIterableNextable');

    const output = [],
      chain = new Chain([
        fromIterable((function*() {
          yield 0;
          yield 1;
        })()),
        streamToArray(output)
      ]);

    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [0, 1])'));
      async.done();
    });
  }
]);
