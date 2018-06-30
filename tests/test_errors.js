'use strict';

const unit = require('heya-unit');

const Chain = require('../index');

unit.add(module, [
  function test_errorsNoStreams(t) {
    try {
      const chain = new Chain([]);
      t.test(false); // shouldn't be here
    } catch (e) {
      eval(t.TEST('e instanceof Error'));
    }
  },
  function test_errorsWrongStreams(t) {
    try {
      const chain = new Chain([1]);
      t.test(false); // shouldn't be here
    } catch (e) {
      eval(t.TEST('e instanceof Error'));
    }
  }
]);
