'use strict';

import test from 'tape-six';

import makeWebStreamPuller from '../src/utils/webStreamPuller.js';

const makeReadable = values =>
  new ReadableStream({
    start(controller) {
      for (const v of values) controller.enqueue(v);
      controller.close();
    }
  });

test.asPromise('makeWebStreamPuller: drains values then signals done', async (t, resolve) => {
  const puller = makeWebStreamPuller(makeReadable([1, 2, 3]));
  const out = [];
  for (;;) {
    const {value, done} = await puller.next();
    if (done) break;
    out.push(value);
  }
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('makeWebStreamPuller: for-await iterates', async (t, resolve) => {
  const out = [];
  for await (const v of makeWebStreamPuller(makeReadable([10, 20, 30]))) out.push(v);
  t.deepEqual(out, [10, 20, 30]);
  resolve();
});

test.asPromise('makeWebStreamPuller: propagates stream error', async (t, resolve) => {
  const original = new Error('source boom');
  let sent = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent) {
        controller.error(original);
        return;
      }
      sent = true;
      controller.enqueue(1);
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

test.asPromise(
  'makeWebStreamPuller: break leaves source uncanceled (preventCancel: true)',
  async (t, resolve) => {
    let canceled = false;
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(1);
        c.enqueue(2);
        c.enqueue(3);
        c.close();
      },
      cancel() {
        canceled = true;
      }
    });
    for await (const v of makeWebStreamPuller(stream)) {
      if (v === 2) break;
    }
    t.equal(canceled, false, 'source not canceled after early break');
    resolve();
  }
);

test.asPromise(
  'makeWebStreamPuller: cancel() cancels stream + releases lock',
  async (t, resolve) => {
    let cancelReason = null;
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(1);
        c.enqueue(2);
      },
      cancel(reason) {
        cancelReason = reason;
      }
    });
    const puller = makeWebStreamPuller(stream);
    await puller.next();
    await puller.cancel(new Error('done'));
    t.equal(cancelReason?.message, 'done', 'cancel reason propagated to stream');
    t.equal(stream.locked, false, 'lock released after cancel');
    resolve();
  }
);
