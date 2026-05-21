'use strict';

import test from 'tape-six';

import {delay, runChain} from '../web-helpers.js';
import {stop} from '../../src/web/index.js';

import take from '../../src/utils/take.js';
import takeWhile from '../../src/utils/takeWhile.js';
import takeWithSkip from '../../src/utils/takeWithSkip.js';

test.asPromise('take: smoke test', async (t, resolve) => {
  const out = await runChain([take(2)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [1, 2]);
  resolve();
});

test.asPromise('simple: with skip', async (t, resolve) => {
  const out = await runChain([takeWithSkip(2, 2)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [3, 4]);
  resolve();
});

test.asPromise('simple: while', async (t, resolve) => {
  const out = await runChain([takeWhile(x => x != 3)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [1, 2]);
  resolve();
});

test.asPromise('simple: while async', async (t, resolve) => {
  const out = await runChain([takeWhile(delay(x => x != 3))], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [1, 2]);
  resolve();
});

test.asPromise('simple: stop', async (t, resolve) => {
  const out = await runChain([take(2, stop)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [1, 2]);
  resolve();
});

test.asPromise('simple: stop with skip', async (t, resolve) => {
  const out = await runChain([takeWithSkip(2, 2, stop)], [1, 2, 3, 4, 5]);
  t.deepEqual(out, [3, 4]);
  resolve();
});
