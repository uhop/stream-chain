'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import {none} from '../src/defs.js';

import asStream from '../src/asStream.js';

test.asPromise('asStream: smoke test', (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']],
    result = [],
    stream = asStream(x => x),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, pattern);
    resolve();
  });

  pattern.forEach(value => stream.write(value));
  stream.end();
});

test.asPromise('asStream: function', (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']],
    result = [],
    stream = asStream(x => (x ? x : none)),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(
      result,
      pattern.filter(x => x)
    );
    resolve();
  });

  pattern.forEach(value => stream.write(value));
  stream.end();
});

test.asPromise('asStream: async function', (t, resolve) => {
  const pattern = [0, 1, true, false, {}, [], {a: 'b'}, ['c']],
    result = [],
    stream = asStream(delay(x => (x ? x : none))),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(
      result,
      pattern.filter(x => x)
    );
    resolve();
  });

  pattern.forEach(value => stream.write(value));
  stream.end();
});

test.asPromise('asStream: generator', (t, resolve) => {
  const pattern = [1, 2, 3],
    result = [],
    stream = asStream(function* () {
      yield* pattern;
    }),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, pattern);
    resolve();
  });

  stream.end(1);
});

test.asPromise('asStream: async generator', (t, resolve) => {
  const pattern = [1, 2, 3],
    result = [],
    stream = asStream(async function* () {
      const fn = delay(x => x);
      yield* pattern.map(value => fn(value));
    }),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, pattern);
    resolve();
  });

  stream.end(1);
});

test('asStream: wrong argument', t => {
  t.throws(() => {
    asStream(1);
    t.fail("shouldn't be here");
  });
});
