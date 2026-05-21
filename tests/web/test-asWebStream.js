'use strict';

import test from 'tape-six';

import {writeAndCollect, delay} from '../web-helpers.js';
import {none} from '../../src/defs.js';

import asWebStream from '../../src/asWebStream.js';

// Mirrors tests/test-asStream.js — same behaviors, Web Streams substrate.

test.asPromise('asWebStream: smoke test', async (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']];
  const stream = asWebStream(x => x);
  const result = await writeAndCollect(stream, pattern);
  t.deepEqual(result, pattern);
  resolve();
});

test.asPromise('asWebStream: function', async (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']];
  const stream = asWebStream(x => (x ? x : none));
  const result = await writeAndCollect(stream, pattern);
  t.deepEqual(
    result,
    pattern.filter(x => x)
  );
  resolve();
});

test.asPromise('asWebStream: async function', async (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']];
  const stream = asWebStream(delay(x => (x ? x : none)));
  const result = await writeAndCollect(stream, pattern);
  t.deepEqual(
    result,
    pattern.filter(x => x)
  );
  resolve();
});

test.asPromise('asWebStream: generator', async (t, resolve) => {
  const pattern = [1, 2, 3];
  const stream = asWebStream(function* () {
    yield* pattern;
  });
  const result = await writeAndCollect(stream, [1]);
  t.deepEqual(result, pattern);
  resolve();
});

test.asPromise('asWebStream: async generator', async (t, resolve) => {
  const pattern = [1, 2, 3];
  const stream = asWebStream(async function* () {
    const fn = delay(x => x);
    yield* pattern.map(value => fn(value));
  });
  const result = await writeAndCollect(stream, [1]);
  t.deepEqual(result, pattern);
  resolve();
});

test('asWebStream: wrong argument', t => {
  t.throws(() => {
    asWebStream(1);
    t.fail("shouldn't be here");
  });
});
