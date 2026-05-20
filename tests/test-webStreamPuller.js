'use strict';

import test from 'tape-six';

import makeWebStreamPuller from '../src/webStreamPuller.js';

const makeReadable = values =>
  new ReadableStream({
    start(controller) {
      for (const v of values) controller.enqueue(v);
      controller.close();
    }
  });

const drain = async puller => {
  const out = [];
  for (;;) {
    const {value, done} = await puller.next();
    if (done) break;
    out.push(value);
  }
  return out;
};

test.asPromise('makeWebStreamPuller: drains values then signals done', async (t, resolve) => {
  const puller = makeWebStreamPuller(makeReadable([1, 2, 3]));
  const out = await drain(puller);
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('makeWebStreamPuller: propagates stream error', async (t, resolve) => {
  const original = new Error('source boom');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(1);
      // Defer the error so the first read can drain the buffered value.
      queueMicrotask(() => controller.error(original));
    }
  });
  const puller = makeWebStreamPuller(stream);
  const {value} = await puller.next();
  t.equal(value, 1);
  try {
    await puller.next();
    t.fail('next() should reject');
  } catch (e) {
    t.equal(e, original);
  }
  resolve();
});

test.asPromise('makeWebStreamPuller: close() releases lock, idempotent', async (t, resolve) => {
  const stream = makeReadable([1, 2, 3]);
  const puller = makeWebStreamPuller(stream);
  await puller.next();
  puller.close();
  puller.close(); // idempotent
  t.equal(stream.locked, false, 'lock released after close');
  // Post-close, next() returns done immediately.
  const r = await puller.next();
  t.deepEqual(r, {value: undefined, done: true});
  resolve();
});

test.asPromise('makeWebStreamPuller: cancel() cancels stream + releases lock', async (t, resolve) => {
  let cancelReason = null;
  const stream = new ReadableStream({
    start(c) { c.enqueue(1); c.enqueue(2); },
    cancel(reason) { cancelReason = reason; }
  });
  const puller = makeWebStreamPuller(stream);
  await puller.next();
  await puller.cancel(new Error('done'));
  t.equal(cancelReason?.message, 'done', 'cancel reason propagated to stream');
  t.equal(stream.locked, false, 'lock released after cancel');
  const r = await puller.next();
  t.deepEqual(r, {value: undefined, done: true});
  // Second cancel is a no-op.
  const second = await puller.cancel();
  t.equal(second, undefined);
  resolve();
});
