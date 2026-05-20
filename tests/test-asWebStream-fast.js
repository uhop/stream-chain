'use strict';

import test from 'tape-six';

import {writeAndCollect, delay} from './helpers.js';
import {none, stop, many, finalValue, flushable} from '../src/defs.js';
import gen from '../src/gen.js';
import asWebStream from '../src/asWebStream.js';

// Mirrors tests/test-asStream-fast.js — same fast-path edge cases, Web Streams substrate.

test.asPromise('asWebStream fast: sync function list', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      x => x * 2,
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [3, 5, 7]);
  resolve();
});

test.asPromise('asWebStream fast: none filtering', async (t, resolve) => {
  const stream = asWebStream(gen(x => (x % 2 === 0 ? none : x)));
  const result = await writeAndCollect(stream, [1, 2, 3, 4, 5, 6]);
  t.deepEqual(result, [1, 3, 5]);
  resolve();
});

test.asPromise('asWebStream fast: stop terminates', async (t, resolve) => {
  const stream = asWebStream(gen(x => (x === 3 ? stop : x)));
  const result = await writeAndCollect(stream, [1, 2, 3, 4, 5]);
  t.deepEqual(result, [1, 2]);
  resolve();
});

test.asPromise('asWebStream fast: many expansion', async (t, resolve) => {
  const stream = asWebStream(gen(x => many([x, x * 10])));
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [1, 10, 2, 20, 3, 30]);
  resolve();
});

test.asPromise('asWebStream fast: many then function', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      x => many([x, x * 10]),
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [2, 11, 3, 21, 4, 31]);
  resolve();
});

test.asPromise('asWebStream fast: finalValue skips rest', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      x => finalValue(x * 2),
      x => x + 1000
    )
  );
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [2, 4, 6]);
  resolve();
});

test.asPromise('asWebStream fast: async function in list', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      delay(x => x * 2, 5),
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [3, 5, 7]);
  resolve();
});

test.asPromise('asWebStream fast: generator in list', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      function* (x) {
        yield x;
        yield x * 10;
      },
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2]);
  t.deepEqual(result, [2, 11, 3, 21]);
  resolve();
});

test.asPromise('asWebStream fast: async generator in list', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      async function* (x) {
        yield x;
        yield x * 10;
      },
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2]);
  t.deepEqual(result, [2, 11, 3, 21]);
  resolve();
});

test.asPromise('asWebStream fast: flushable function', async (t, resolve) => {
  let flushed = false;
  const stream = asWebStream(
    gen(
      flushable(
        x => x * 2,
        () => {
          flushed = true;
          return 999;
        }
      )
    )
  );
  const result = await writeAndCollect(stream, [1, 2]);
  t.ok(flushed);
  t.deepEqual(result, [2, 4, 999]);
  resolve();
});

test.asPromise('asWebStream fast: flushable with downstream', async (t, resolve) => {
  const stream = asWebStream(
    gen(
      flushable(
        x => x,
        () => 100
      ),
      x => x + 1
    )
  );
  const result = await writeAndCollect(stream, [1, 2]);
  t.deepEqual(result, [2, 3, 101]);
  resolve();
});

test.asPromise('asWebStream fast: mixed none/many/value', async (t, resolve) => {
  const stream = asWebStream(
    gen(x => {
      if (x === 1) return none;
      if (x === 2) return many([20, 21]);
      return x;
    })
  );
  const result = await writeAndCollect(stream, [1, 2, 3]);
  t.deepEqual(result, [20, 21, 3]);
  resolve();
});
