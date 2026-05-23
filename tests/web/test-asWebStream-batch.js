'use strict';

import test from 'tape-six';

import {writeAndCollect, delay} from '../web-helpers.js';
import {many, isMany, getManyValues, none, stop, flushable} from '../../src/defs.js';

import asWebStream from '../../src/asWebStream.js';
import gen from '../../src/gen.js';
import take from '../../src/utils/take.js';

// Mirrors tests/node/test-asStream-batch.js on the Web Streams substrate.

const shapes = chunks =>
  chunks.map(c => (isMany(c) ? 'many(' + getManyValues(c).length + ')' : 'item'));
const flat = chunks => chunks.flatMap(c => (isMany(c) ? getManyValues(c) : [c]));

for (const [label, make] of [
  ['function-list', () => gen(x => x)],
  ['plain fn', () => x => x]
]) {
  test.asPromise(
    `asWebStream batch: coalesces into many() with partial flush (${label})`,
    async (t, resolve) => {
      const raw = await writeAndCollect(
        asWebStream(make(), {batch: 4}),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      t.deepEqual(shapes(raw), ['many(4)', 'many(4)', 'many(2)']);
      t.deepEqual(flat(raw), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      resolve();
    }
  );

  test.asPromise(
    `asWebStream batch: batch<=1 and unset stay per-item (${label})`,
    async (t, resolve) => {
      for (const opts of [undefined, {batch: 1}, {batch: 0}]) {
        const raw = await writeAndCollect(asWebStream(make(), opts), [1, 2, 3]);
        t.deepEqual(shapes(raw), ['item', 'item', 'item']);
        t.deepEqual(flat(raw), [1, 2, 3]);
      }
      resolve();
    }
  );
}

test.asPromise(
  'asWebStream batch: fan-out many() re-batches at the boundary',
  async (t, resolve) => {
    const raw = await writeAndCollect(
      asWebStream(
        gen(i => many([i * 10, i * 10 + 1])),
        {batch: 3}
      ),
      [0, 1, 2]
    );
    t.deepEqual(shapes(raw), ['many(3)', 'many(3)']);
    t.deepEqual(flat(raw), [0, 1, 10, 11, 20, 21]);
    resolve();
  }
);

test.asPromise(
  'asWebStream batch: stop flushes the partial batch then ends',
  async (t, resolve) => {
    const raw = await writeAndCollect(
      asWebStream(gen(take(2, stop)), {batch: 5}),
      [1, 2, 3, 4, 5, 6]
    );
    t.deepEqual(shapes(raw), ['many(2)']);
    t.deepEqual(flat(raw), [1, 2]);
    resolve();
  }
);

test.asPromise(
  'asWebStream batch: flushable trailing output is batched + flushed at close',
  async (t, resolve) => {
    const collectAll = () => {
      let buf = [];
      return flushable(v => {
        if (v === none) return many(buf);
        buf.push(v);
        return none;
      });
    };
    const raw = await writeAndCollect(asWebStream(gen(collectAll()), {batch: 3}), [1, 2, 3, 4, 5]);
    t.deepEqual(shapes(raw), ['many(3)', 'many(2)']);
    t.deepEqual(flat(raw), [1, 2, 3, 4, 5]);
    resolve();
  }
);

test.asPromise(
  'asWebStream batch: many() INPUT is unbundled before a plain fn (processInput)',
  async (t, resolve) => {
    const seen = [];
    const stream = asWebStream(x => {
      seen.push(x);
      return x * 10;
    });
    const raw = await writeAndCollect(stream, [many([1, 2, 3]), 4]);
    t.deepEqual(seen, [1, 2, 3, 4], 'fn saw individual values, not the envelope');
    t.deepEqual(flat(raw), [10, 20, 30, 40]);
    resolve();
  }
);

test.asPromise(
  'asWebStream batch: async fn batches correctly (backpressure-aware)',
  async (t, resolve) => {
    const raw = await writeAndCollect(
      asWebStream(gen(delay(x => x * 2)), {batch: 4}),
      [1, 2, 3, 4, 5]
    );
    t.deepEqual(flat(raw), [2, 4, 6, 8, 10]);
    t.ok(raw.every(isMany), 'every emitted chunk is a many() batch');
    resolve();
  }
);
