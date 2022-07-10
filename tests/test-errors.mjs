'use strict';

import test from 'tape-six';

import chain from '../src/index.js';

test('errors: no streams', t => {
  t.throws(() => {
    chain([]);
    t.fail("shouldn't be here");
  });
});

test('errors: wrong stream', t => {
  t.throws(() => {
    chain([1]);
    t.fail("shouldn't be here");
  });
});
