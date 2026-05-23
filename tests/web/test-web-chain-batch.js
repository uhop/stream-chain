'use strict';

import test from 'tape-six';

import chain from '../../src/web/index.js';
import {batched, isMany, getManyValues} from '../../src/defs.js';

// Mirrors tests/node/test-chain-batch.js on the Web Streams substrate.
// (The /web chain has no noGrouping mode and no Node-stream conversion.)

const items = n => Array.from({length: n}, (_, i) => i);
const flat = chunks => chunks.flatMap(c => (isMany(c) ? getManyValues(c) : [c]));

const srcFrom = arr =>
  new ReadableStream({
    start(c) {
      for (const v of arr) c.enqueue(v);
      c.close();
    }
  });

// A recording sink (collects raw chunks) with a `done` promise. `mark` makes it
// batch-capable.
const recSink = mark => {
  const raw = [];
  let done;
  const donePromise = new Promise(r => (done = r));
  const w = new WritableStream({
    write(c) {
      raw.push(c);
    },
    close() {
      done();
    },
    abort() {
      done();
    }
  });
  return {sink: mark ? batched(w) : w, raw, done: donePromise};
};

const readOutput = async c => {
  const raw = [];
  for await (const ch of c.readable) raw.push(ch);
  return raw;
};

test.asPromise(
  'web chain batch: batches a section drain into a batched() sink',
  async (t, resolve) => {
    const s = recSink(true);
    chain([srcFrom(items(10)), x => x, s.sink], {batch: 4});
    await s.done;
    t.deepEqual(
      s.raw.map(c => getManyValues(c).length),
      [4, 4, 2]
    );
    t.deepEqual(flat(s.raw), items(10));
    resolve();
  }
);

test.asPromise('web chain batch: a plain (unmarked) sink stays per-item', async (t, resolve) => {
  const s = recSink(false);
  chain([srcFrom(items(10)), x => x, s.sink], {batch: 4});
  await s.done;
  t.notOk(s.raw.some(isMany));
  t.deepEqual(s.raw, items(10));
  resolve();
});

test.asPromise('web chain batch: batchOutput batches the chain output', async (t, resolve) => {
  const raw = await readOutput(chain([srcFrom(items(10)), x => x], {batch: 4, batchOutput: true}));
  t.ok(raw.length > 0 && raw.every(isMany));
  t.deepEqual(flat(raw), items(10));
  resolve();
});

test.asPromise('web chain batch: no batchOutput keeps the output per-item', async (t, resolve) => {
  const raw = await readOutput(chain([srcFrom(items(10)), x => x], {batch: 4}));
  t.notOk(raw.some(isMany));
  t.deepEqual(raw, items(10));
  resolve();
});

test.asPromise(
  'web chain batch: batch<=1 disables even into a batched() sink',
  async (t, resolve) => {
    const s = recSink(true);
    chain([srcFrom(items(5)), x => x, s.sink], {batch: 1});
    await s.done;
    t.notOk(s.raw.some(isMany));
    t.deepEqual(s.raw, items(5));
    resolve();
  }
);

test.asPromise(
  'web chain batch: default size (no option) batches into a batched() sink',
  async (t, resolve) => {
    const s = recSink(true);
    chain([srcFrom(items(5)), x => x, s.sink]); // batch defaults to 1000
    await s.done;
    t.equal(s.raw.length, 1);
    t.ok(isMany(s.raw[0]));
    t.deepEqual(flat(s.raw), items(5));
    resolve();
  }
);

test.asPromise(
  'web chain batch: data is identical batched vs. per-item (drop-in)',
  async (t, resolve) => {
    const src = items(50);
    const fn = x => x * 3 + 1;
    const a = recSink(false);
    chain([srcFrom(src), fn, a.sink], {batch: 1});
    await a.done;
    const b = recSink(true);
    chain([srcFrom(src), fn, b.sink], {batch: 7});
    await b.done;
    t.deepEqual(flat(b.raw), a.raw);
    t.ok(b.raw.some(isMany) && !a.raw.some(isMany));
    resolve();
  }
);
