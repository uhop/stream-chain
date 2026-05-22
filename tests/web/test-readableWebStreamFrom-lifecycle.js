'use strict';

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import readableWebStreamFrom from '../../src/utils/readableWebStreamFrom.js';

// Lifecycle / error-propagation tests for readableWebStreamFrom.

test.asPromise(
  'readableWebStreamFrom: iterator throw propagates as readable error',
  async (t, resolve) => {
    const stream = readableWebStreamFrom(function* () {
      yield 1;
      throw new Error('iter-boom');
    });
    const reader = stream.getReader();

    const first = await reader.read();
    t.equal(first.value, 1);

    try {
      await reader.read();
      t.fail('reader.read() should reject');
    } catch (e) {
      t.equal(e?.message, 'iter-boom');
    }
    resolve();
  }
);

test.asPromise('readableWebStreamFrom: async function rejection propagates', async (t, resolve) => {
  const stream = readableWebStreamFrom(async () => {
    await delay(() => null, 5)();
    throw new Error('async-boom');
  });
  const reader = stream.getReader();

  try {
    await reader.read();
    t.fail('reader.read() should reject');
  } catch (e) {
    t.equal(e?.message, 'async-boom');
  }
  resolve();
});

test.asPromise(
  'readableWebStreamFrom: cancel after partial drain — pump halts',
  async (t, resolve) => {
    let produced = 0;
    const stream = readableWebStreamFrom(function* () {
      while (true) yield ++produced;
    });
    const reader = stream.getReader();
    await reader.read(); // 1
    await reader.read(); // 2
    await reader.cancel();
    const before = produced;
    await delay(() => null, 20)();
    t.ok(produced - before <= 1, 'pump halts within a tick of cancel');
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: pipeThrough composes with downstream transforms',
  async (t, resolve) => {
    const stream = readableWebStreamFrom([1, 2, 3]);
    const collected = [];
    await stream
      .pipeThrough(
        new TransformStream({
          transform(chunk, c) {
            c.enqueue(chunk * 10);
          }
        })
      )
      .pipeTo(
        new WritableStream({
          write(chunk) {
            collected.push(chunk);
          }
        })
      );
    t.deepEqual(collected, [10, 20, 30]);
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: backpressure with hwm=1 + slow consumer',
  async (t, resolve) => {
    const stream = readableWebStreamFrom({
      iterable: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      strategy: {highWaterMark: 1}
    });
    const reader = stream.getReader();
    const out = [];
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      out.push(value);
      await delay(() => null, 2)();
    }
    t.deepEqual(out, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    resolve();
  }
);
