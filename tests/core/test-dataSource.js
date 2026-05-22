'use strict';

import test from 'tape-six';

import dataSource from '../../src/dataSource.js';

// Substrate-agnostic: dataSource is just a function coercion — no streams,
// no platform. Tests live in /core so they run in browser + CLI from the
// same source.

test('dataSource: passes a function through unchanged', t => {
  const original = () => 42;
  t.equal(dataSource(original), original);
});

test('dataSource: array → iterator factory', t => {
  const fn = dataSource([1, 2, 3]);
  t.equal(typeof fn, 'function');
  t.deepEqual([...fn()], [1, 2, 3]);
});

test('dataSource: generator function returns itself (it IS a function)', t => {
  const gen = function* () {
    yield 1;
    yield 2;
  };
  t.equal(dataSource(gen), gen);
});

test('dataSource: generator instance → iterator factory bound to it', t => {
  const it = (function* () {
    yield 1;
    yield 2;
  })();
  const fn = dataSource(it);
  t.equal(typeof fn, 'function');
  t.deepEqual([...fn()], [1, 2]);
});

test.asPromise('dataSource: async iterable → async iterator factory', async (t, resolve) => {
  const iterable = {
    async *[Symbol.asyncIterator]() {
      yield 10;
      yield 20;
    }
  };
  const fn = dataSource(iterable);
  t.equal(typeof fn, 'function');
  const out = [];
  for await (const v of fn()) out.push(v);
  t.deepEqual(out, [10, 20]);
  resolve();
});

test('dataSource: throws on non-function non-iterable', t => {
  t.throws(() => dataSource(42), TypeError);
  t.throws(() => dataSource(null), TypeError);
  t.throws(() => dataSource(undefined), TypeError);
  t.throws(() => dataSource({not: 'iterable'}), TypeError);
});

test('dataSource: exported from /web and /core entries', async t => {
  const webEntry = await import('../../src/web/index.js');
  const coreEntry = await import('../../src/core/index.js');
  t.equal(typeof webEntry.dataSource, 'function', '/web re-exports dataSource');
  t.equal(typeof coreEntry.dataSource, 'function', '/core re-exports dataSource');
  t.equal(typeof webEntry.default.dataSource, 'function', 'chain.dataSource on /web');
  t.equal(typeof coreEntry.default.dataSource, 'function', 'chain.dataSource on /core');
});
