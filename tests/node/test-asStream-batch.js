'use strict';

import test from 'tape-six';

import {streamToArray, delay} from '../helpers.js';
import {many, isMany, getManyValues, none, stop, flushable} from '../../src/defs.js';

import asStream from '../../src/asStream.js';
import gen from '../../src/gen.js';
import take from '../../src/utils/take.js';

const shapes = chunks =>
  chunks.map(c => (isMany(c) ? 'many(' + getManyValues(c).length + ')' : 'item'));
const flat = chunks => chunks.flatMap(c => (isMany(c) ? getManyValues(c) : [c]));

const drain = (stream, inputs) =>
  new Promise((resolve, reject) => {
    const raw = [];
    stream
      .pipe(streamToArray(raw))
      .on('finish', () => resolve(raw))
      .on('error', reject);
    inputs.forEach(v => stream.write(v));
    stream.end();
  });

// Both substrate paths must batch identically: the applyFns path (a gen/fun
// function-list) and the plain-fn path (processValue/processInput).
for (const [label, make] of [
  ['function-list', () => gen(x => x)],
  ['plain fn', () => x => x]
]) {
  test.asPromise(
    `asStream batch: coalesces into many() with partial flush (${label})`,
    async (t, resolve) => {
      const raw = await drain(asStream(make(), {batch: 4}), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      t.deepEqual(shapes(raw), ['many(4)', 'many(4)', 'many(2)']);
      t.deepEqual(flat(raw), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      resolve();
    }
  );

  test.asPromise(
    `asStream batch: batch<=1 and unset stay per-item (${label})`,
    async (t, resolve) => {
      for (const opts of [undefined, {batch: 1}, {batch: 0}]) {
        const raw = await drain(asStream(make(), opts), [1, 2, 3]);
        t.deepEqual(shapes(raw), ['item', 'item', 'item']);
        t.deepEqual(flat(raw), [1, 2, 3]);
      }
      resolve();
    }
  );
}

test.asPromise('asStream batch: fan-out many() re-batches at the boundary', async (t, resolve) => {
  const raw = await drain(
    asStream(
      gen(i => many([i * 10, i * 10 + 1])),
      {batch: 3}
    ),
    [0, 1, 2]
  );
  t.deepEqual(shapes(raw), ['many(3)', 'many(3)']);
  t.deepEqual(flat(raw), [0, 1, 10, 11, 20, 21]);
  resolve();
});

test.asPromise('asStream batch: stop flushes the partial batch then ends', async (t, resolve) => {
  const raw = await drain(asStream(gen(take(2, stop)), {batch: 5}), [1, 2, 3, 4, 5, 6]);
  t.deepEqual(shapes(raw), ['many(2)']);
  t.deepEqual(flat(raw), [1, 2]);
  resolve();
});

test.asPromise(
  'asStream batch: flushable trailing output is batched + flushed at final',
  async (t, resolve) => {
    // A flushable that buffers everything and emits it as many() on flush(none).
    const collectAll = () => {
      let buf = [];
      return flushable(v => {
        if (v === none) return many(buf);
        buf.push(v);
        return none;
      });
    };
    const raw = await drain(asStream(gen(collectAll()), {batch: 3}), [1, 2, 3, 4, 5]);
    // flush emits many([1..5]) -> applyFns unbundles -> enqueue re-batches at 3.
    t.deepEqual(shapes(raw), ['many(3)', 'many(2)']);
    t.deepEqual(flat(raw), [1, 2, 3, 4, 5]);
    resolve();
  }
);

test.asPromise(
  'asStream batch: many() INPUT is unbundled before a plain fn (processInput)',
  async (t, resolve) => {
    const seen = [];
    const stream = asStream(x => {
      seen.push(x);
      return x * 10;
    });
    const raw = await new Promise((res, rej) => {
      const out = [];
      stream
        .pipe(streamToArray(out))
        .on('finish', () => res(out))
        .on('error', rej);
      stream.write(many([1, 2, 3])); // a batched chunk as input
      stream.write(4); // a plain chunk
      stream.end();
    });
    t.deepEqual(seen, [1, 2, 3, 4], 'fn saw individual values, not the envelope');
    t.deepEqual(flat(raw), [10, 20, 30, 40]);
    resolve();
  }
);

test.asPromise(
  'asStream batch: async fn batches correctly (backpressure-aware)',
  async (t, resolve) => {
    const raw = await drain(asStream(gen(delay(x => x * 2)), {batch: 4}), [1, 2, 3, 4, 5]);
    t.deepEqual(flat(raw), [2, 4, 6, 8, 10]);
    t.ok(raw.every(isMany), 'every emitted chunk is a many() batch');
    resolve();
  }
);
