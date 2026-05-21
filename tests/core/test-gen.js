'use strict';

import test from 'tape-six';

import {delay, runChain} from '../web-helpers.js';
import {none, finalValue, many, gen} from '../../src/web/index.js';

test.asPromise('gen: smoke test', async (t, resolve) => {
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

test.asPromise('gen: final', async (t, resolve) => {
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

test.asPromise('gen: nothing', async (t, resolve) => {
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

test.asPromise('gen: empty', async (t, resolve) => {
  const out = await runChain([x => x * x, gen()], [1, 2, 3]);
  t.deepEqual(out, [1, 4, 9]);
  resolve();
});

test.asPromise('gen: async', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        delay(x => x * x),
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('gen: generator', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        function* (x) {
          yield x;
          yield x + 1;
          yield x + 2;
        },
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
  resolve();
});

test.asPromise('gen: many', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        x => x * x,
        x => many([x, x + 1, x + 2]),
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
  resolve();
});

test.asPromise('gen: combined', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield x - 1;
        },
        x => -x
      )
    ],
    [1, 2]
  );
  t.deepEqual(out, [1, 2, 10, 11, 2, 3, 20, 21]);
  resolve();
});

test.asPromise('gen: combined final', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield finalValue(x - 1);
        },
        x => -x
      )
    ],
    [1, 2]
  );
  t.deepEqual(out, [1, -2, 10, -11, 2, -3, 20, -21]);
  resolve();
});

test.asPromise('gen: iterator', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield finalValue(x - 1);
        },
        x => -x
      )
    ],
    [1, 2]
  );
  t.deepEqual(out, [1, -2, 10, -11, 2, -3, 20, -21]);
  resolve();
});

test.asPromise('gen: async iterator', async (t, resolve) => {
  const out = await runChain(
    [
      gen(
        delay(x => -x),
        x => many([x, x * 10]),
        async function* (x) {
          yield delay(x => x)(x);
          yield delay(x => finalValue(x - 1))(x);
        },
        x => -x
      )
    ],
    [1, 2]
  );
  t.deepEqual(out, [1, -2, 10, -11, 2, -3, 20, -21]);
  resolve();
});

test.asPromise('gen: array', async (t, resolve) => {
  const out = await runChain([[x => x * x, x => 2 * x + 1]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('gen: embedded arrays', async (t, resolve) => {
  const out = await runChain([[x => x * x, [x => 2 * x + 1, []]]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});
