'use strict';

import test from 'tape-six';

import {runChain} from '../web-helpers.js';
import {many} from '../../src/defs.js';

import unbatch from '../../src/utils/unbatch.js';

test('unbatch: a non-batch value passes straight through', t => {
  t.equal(unbatch()(7), 7);
});

test.asPromise('unbatch: unbundles many() chunks in a chain', async (t, resolve) => {
  // many() chunks simulate a batched() producer's output; the chain fans them
  // at the unbatch() section back into individual items for a per-item consumer.
  const out = await runChain([unbatch()], [many([1, 2, 3]), 4, many([5, 6])]);
  t.deepEqual(out, [1, 2, 3, 4, 5, 6]);
  resolve();
});

test.asPromise('unbatch: transparent for an already per-item stream', async (t, resolve) => {
  const out = await runChain([unbatch()], [1, 2, 3]);
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('unbatch: empty many() contributes nothing', async (t, resolve) => {
  const out = await runChain([unbatch()], [many([]), 1, many([2])]);
  t.deepEqual(out, [1, 2]);
  resolve();
});
