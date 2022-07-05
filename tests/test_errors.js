'use strict';

const unit = require('heya-unit');

const chain = require('../src/index');

unit.add(module, [
  function test_errorsNoStreams(t) {
    try {
      const c = chain([]);
      t.test(false); // shouldn't be here
    } catch (e) {
      eval(t.TEST('e instanceof Error'));
    }
  },
  function test_errorsWrongStreams(t) {
    try {
      const c = chain([1]);
      t.test(false); // shouldn't be here
    } catch (e) {
      eval(t.TEST('e instanceof Error'));
    }
  }
]);
