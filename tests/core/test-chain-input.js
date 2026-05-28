'use strict';

import test from 'tape-six';

import chain from '../../src/core/index.js';

const collect = async asyncIter => {
  const out = [];
  for await (const v of asyncIter) out.push(v);
  return out;
};

test.asPromise('chain /core: string input passes through as one value', async (t, resolve) => {
  const c = chain([s => s.toUpperCase()]);
  t.deepEqual(await collect(c('input.json')), ['INPUT.JSON']);
  resolve();
});

test.asPromise('chain /core: number input passes through as one value', async (t, resolve) => {
  const c = chain([n => n * n]);
  t.deepEqual(await collect(c(7)), [49]);
  resolve();
});

test.asPromise('chain /core: boolean input passes through as one value', async (t, resolve) => {
  const c = chain([b => !b]);
  t.deepEqual(await collect(c(true)), [false]);
  resolve();
});

test.asPromise('chain /core: plain-object input passes through as one value', async (t, resolve) => {
  const c = chain([o => o.foo]);
  t.deepEqual(await collect(c({foo: 'bar'})), ['bar']);
  resolve();
});

test.asPromise('chain /core: null input yields nothing', async (t, resolve) => {
  const c = chain([x => x * 2]);
  t.deepEqual(await collect(c(null)), []);
  resolve();
});

test.asPromise('chain /core: undefined input yields nothing', async (t, resolve) => {
  const c = chain([x => x * 2]);
  t.deepEqual(await collect(c(undefined)), []);
  resolve();
});

test.asPromise('chain /core: array input iterates per element', async (t, resolve) => {
  const c = chain([x => x * x]);
  t.deepEqual(await collect(c([1, 2, 3])), [1, 4, 9]);
  resolve();
});

test.asPromise('chain /core: sync iterable input iterates per element', async (t, resolve) => {
  const c = chain([x => x + 1]);
  const set = new Set([10, 20, 30]);
  t.deepEqual(await collect(c(set)), [11, 21, 31]);
  resolve();
});

test.asPromise('chain /core: generator input iterates per yield', async (t, resolve) => {
  const c = chain([x => x * 2]);
  function* gen() {
    yield 1;
    yield 2;
    yield 3;
  }
  t.deepEqual(await collect(c(gen())), [2, 4, 6]);
  resolve();
});

test.asPromise('chain /core: async iterable input iterates per yield', async (t, resolve) => {
  const c = chain([x => x + 100]);
  async function* gen() {
    yield 1;
    yield 2;
    yield 3;
  }
  t.deepEqual(await collect(c(gen())), [101, 102, 103]);
  resolve();
});
