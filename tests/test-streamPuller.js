'use strict';

import test from 'tape-six';

import {Readable} from 'node:stream';

import makeStreamPuller from '../src/streamPuller.js';

const makeReadable = values =>
  Readable.from(values, {objectMode: true});

const drain = async puller => {
  const out = [];
  for (;;) {
    const {value, done} = await puller.next();
    if (done) break;
    out.push(value);
  }
  return out;
};

test.asPromise('makeStreamPuller: drains values then signals done', async (t, resolve) => {
  const puller = makeStreamPuller(makeReadable([1, 2, 3]));
  const out = await drain(puller);
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('makeStreamPuller: preserves original error (no AbortError wrap)', async (t, resolve) => {
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
});

test.asPromise('makeStreamPuller: premature close surfaces synthetic error', async (t, resolve) => {
  const stream = new Readable({objectMode: true, read() {}});
  const puller = makeStreamPuller(stream);
  const nextPromise = puller.next();
  setTimeout(() => stream.destroy(), 10);
  try {
    await nextPromise;
    t.fail('next() should reject');
  } catch (e) {
    t.equal(e.message, 'Premature stream close');
  }
  resolve();
});

test.asPromise('makeStreamPuller: close() detaches listeners, idempotent', async (t, resolve) => {
  const stream = makeReadable([1, 2, 3]);
  const puller = makeStreamPuller(stream);
  await puller.next();
  puller.close();
  puller.close(); // idempotent
  t.equal(stream.listenerCount('data'), 0, 'no leaked data listener');
  t.equal(stream.listenerCount('end'), 0, 'no leaked end listener');
  t.equal(stream.listenerCount('error'), 0, 'no leaked error listener');
  t.equal(stream.listenerCount('close'), 0, 'no leaked close listener');
  resolve();
});

test.asPromise('makeStreamPuller: backpressure — buffered chunks pause source', async (t, resolve) => {
  // Source pushes one chunk per read() call; we never call next() so all chunks
  // are buffered and the source is paused after the first.
  let reads = 0;
  const stream = new Readable({
    objectMode: true,
    read() {
      ++reads;
      if (reads <= 5) this.push(reads);
      else this.push(null);
    }
  });
  const puller = makeStreamPuller(stream);
  // Give the source a few ticks to push and get paused.
  await new Promise(r => setTimeout(r, 20));
  t.ok(stream.isPaused(), 'source paused under backpressure');
  // Drain to release.
  const out = await drain(puller);
  t.deepEqual(out, [1, 2, 3, 4, 5]);
  resolve();
});
