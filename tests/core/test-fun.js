'use strict';

import test from 'tape-six';

import {delay, runChain} from '../web-helpers.js';
import {none, finalValue, many} from '../../src/web/index.js';

import fun from '../../src/fun.js';

test.asPromise('fun: smoke test', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
        x => x * x,
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('fun: final', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: nothing', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: empty', async (t, resolve) => {
  const out = await runChain([x => x * x, fun()], [1, 2, 3]);
  t.deepEqual(out, [1, 4, 9]);
  resolve();
});

test.asPromise('fun: async', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
        delay(x => x * x),
        x => 2 * x + 1
      )
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('fun: generator', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: many', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: combined', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: combined final', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: as fun', async (t, resolve) => {
  const out = await runChain(
    [
      fun(
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

test.asPromise('fun: array', async (t, resolve) => {
  const out = await runChain([[x => x * x, x => 2 * x + 1]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});

test.asPromise('fun: embedded arrays', async (t, resolve) => {
  const out = await runChain([[x => x * x, [x => 2 * x + 1, []]]], [1, 2, 3]);
  t.deepEqual(out, [3, 9, 19]);
  resolve();
});
