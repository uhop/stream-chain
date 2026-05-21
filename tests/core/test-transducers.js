'use strict';

import test from 'tape-six';

import {runChain} from '../web-helpers.js';
import {gen, none, finalValue, clearFunctionList} from '../../src/web/index.js';

test.asPromise('transducers: smoke test', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('transducers: final', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        x => finalValue(x),
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [1, 4, 9]);
  resolve();
});

test.asPromise('transducers: nothing', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        () => none,
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, []);
  resolve();
});

test.asPromise('transducers: empty', async (t, resolve) => {
  const out = await runChain([x => x * x, gen()], [1, 2, 3]);
  t.deepEqual(out, [1, 4, 9]);
  resolve();
});

test.asPromise('transducers: one', async (t, resolve) => {
  const out = await runChain([x => x * x, gen(x => 2 * x + 1)], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('transducers: array', async (t, resolve) => {
  const out = await runChain([[x => x * x, x => 2 * x + 1]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('transducers: embedded arrays', async (t, resolve) => {
  const out = await runChain([[x => x * x, [x => 2 * x + 1, []]]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('transducers: optimize function lists', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        x => finalValue(x),
        x => 2 * x + 1
      ),
      x => x + 1
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [1, 4, 9]);
  resolve();
});

test.asPromise("transducers: don't optimize function lists", async (t, resolve) => {
  const out = await runChain(
    [
      clearFunctionList(
        gen(
          x => x * x,
          x => finalValue(x),
          x => 2 * x + 1
        )
      ),
      x => x + 1
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [2, 5, 10]);
  resolve();
});
