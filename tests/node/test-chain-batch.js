'use strict';

import test from 'tape-six';

import {Writable} from 'node:stream';
import {finished} from 'node:stream/promises';

import chain from '../../src/index.js';
import readableFrom from '../../src/utils/readableFrom.js';
import {batched, isMany, getManyValues} from '../../src/defs.js';

const items = n => Array.from({length: n}, (_, i) => i);
const flat = chunks => chunks.flatMap(c => (isMany(c) ? getManyValues(c) : [c]));

// A recording sink (collects raw chunks). `mark` makes it batch-capable.
const recSink = mark => {
  const raw = [];
  const w = new Writable({
    objectMode: true,
    write(chunk, _enc, cb) {
      raw.push(chunk);
      cb();
    }
  });
  w.raw = raw;
  return mark ? batched(w) : w;
};

// Read a (readable) chain's own output into an array.
const readOutput = pipeline =>
  new Promise((resolve, reject) => {
    const raw = [];
    pipeline.on('data', c => raw.push(c));
    pipeline.on('end', () => resolve(raw));
    pipeline.on('error', reject);
  });

test.asPromise('chain batch: batches a section drain into a batched() sink', async (t, resolve) => {
  const sink = recSink(true);
  chain([readableFrom(items(10)), x => x, sink], {batch: 4});
  await finished(sink);
  t.deepEqual(
    sink.raw.map(c => getManyValues(c).length),
    [4, 4, 2]
  );
  t.deepEqual(flat(sink.raw), items(10));
  resolve();
});

test.asPromise('chain batch: a plain (unmarked) sink stays per-item', async (t, resolve) => {
  const sink = recSink(false);
  chain([readableFrom(items(10)), x => x, sink], {batch: 4});
  await finished(sink);
  t.notOk(sink.raw.some(isMany), 'no many() chunks reached the plain sink');
  t.deepEqual(sink.raw, items(10));
  resolve();
});

test.asPromise('chain batch: batchOutput batches the chain output', async (t, resolve) => {
  const raw = await readOutput(
    chain([readableFrom(items(10)), x => x], {batch: 4, batchOutput: true})
  );
  t.ok(raw.length > 0 && raw.every(isMany), 'output delivered as many() chunks');
  t.deepEqual(flat(raw), items(10));
  resolve();
});

test.asPromise(
  'chain batch: no batchOutput keeps the chain output per-item',
  async (t, resolve) => {
    const raw = await readOutput(chain([readableFrom(items(10)), x => x], {batch: 4}));
    t.notOk(raw.some(isMany), 'output stayed per-item');
    t.deepEqual(raw, items(10));
    resolve();
  }
);

test.asPromise('chain batch: batch<=1 disables even into a batched() sink', async (t, resolve) => {
  const sink = recSink(true);
  chain([readableFrom(items(5)), x => x, sink], {batch: 1});
  await finished(sink);
  t.notOk(sink.raw.some(isMany));
  t.deepEqual(sink.raw, items(5));
  resolve();
});

test.asPromise(
  'chain batch: default size (no option) batches into a batched() sink',
  async (t, resolve) => {
    const sink = recSink(true);
    chain([readableFrom(items(5)), x => x, sink]); // batch defaults to 1000
    await finished(sink);
    t.equal(sink.raw.length, 1, '5 items (< 1000) flush as a single batch');
    t.ok(isMany(sink.raw[0]));
    t.deepEqual(flat(sink.raw), items(5));
    resolve();
  }
);

test.asPromise(
  'chain batch: noGrouping ignores batch (per-stage debug mode)',
  async (t, resolve) => {
    const sink = recSink(true);
    chain([readableFrom(items(5)), x => x, sink], {noGrouping: true, batch: 1000});
    await finished(sink);
    t.notOk(sink.raw.some(isMany), 'noGrouping never batches');
    t.deepEqual(sink.raw, items(5));
    resolve();
  }
);

test.asPromise(
  'chain batch: batched() marker survives Web→Node conversion of a trailing sink',
  async (t, resolve) => {
    const raw = [];
    let done;
    const donePromise = new Promise(r => (done = r));
    const ws = batched(
      new WritableStream({
        write(c) {
          raw.push(c);
        },
        close() {
          done();
        }
      })
    );
    chain([readableFrom(items(6)), x => x, ws], {batch: 3});
    await donePromise;
    t.deepEqual(
      raw.map(c => getManyValues(c).length),
      [3, 3],
      'section batched into the (converted) batched() web sink'
    );
    t.deepEqual(flat(raw), items(6));
    resolve();
  }
);

test.asPromise(
  'chain batch: data is identical batched vs. per-item (drop-in)',
  async (t, resolve) => {
    const src = items(50);
    const fn = x => x * 3 + 1;
    const perItem = recSink(false);
    chain([readableFrom(src), fn, perItem], {batch: 1});
    await finished(perItem);
    const batchedSink = recSink(true);
    chain([readableFrom(src), fn, batchedSink], {batch: 7});
    await finished(batchedSink);
    t.deepEqual(flat(batchedSink.raw), perItem.raw, 'same values in the same order');
    t.ok(batchedSink.raw.some(isMany) && !perItem.raw.some(isMany));
    resolve();
  }
);
