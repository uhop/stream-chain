'use strict';

import test from 'tape-six';

import {Readable} from 'node:stream';

import makeStreamPuller from '../src/utils/streamPuller.js';

const makeReadable = values => Readable.from(values, {objectMode: true});

test.asPromise('makeStreamPuller: drains values then signals done', async (t, resolve) => {
  const puller = makeStreamPuller(makeReadable([1, 2, 3]));
  const out = [];
  for (;;) {
    const {value, done} = await puller.next();
    if (done) break;
    out.push(value);
  }
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('makeStreamPuller: for-await iterates', async (t, resolve) => {
  const out = [];
  for await (const v of makeStreamPuller(makeReadable([10, 20, 30]))) out.push(v);
  t.deepEqual(out, [10, 20, 30]);
  resolve();
});

test.asPromise(
  'makeStreamPuller: preserves original error (no AbortError wrap)',
  async (t, resolve) => {
    const original = new Error('source boom');
    const stream = new Readable({
      objectMode: true,
      read() {
        this.push(1);
        this.destroy(original);
      }
    });
    const puller = makeStreamPuller(stream);
    const {value} = await puller.next();
    t.equal(value, 1);
    try {
      await puller.next();
      t.fail('next() should reject');
    } catch (e) {
      t.equal(e, original, 'rejection is the original error, not wrapped');
    }
    resolve();
  }
);

test.asPromise('makeStreamPuller: premature close surfaces synthetic error', async (t, resolve) => {
  const stream = new Readable({objectMode: true, read() {}});
  const puller = makeStreamPuller(stream);
  const nextPromise = puller.next();
  setTimeout(() => stream.destroy(), 10);
  try {
    await nextPromise;
    t.fail('next() should reject');
  } catch (e) {
    t.equal(e.message, 'Premature close');
  }
  resolve();
});

test.asPromise(
  'makeStreamPuller: break leaves source alive (destroyOnReturn: false)',
  async (t, resolve) => {
    const stream = makeReadable([1, 2, 3, 4, 5]);
    for await (const v of makeStreamPuller(stream)) {
      if (v === 2) break;
    }
    t.equal(stream.destroyed, false, 'source not destroyed after early break');
    resolve();
  }
);
