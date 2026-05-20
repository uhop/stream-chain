'use strict';

import test from 'tape-six';

import asStream from '../src/asStream.js';

// Lifecycle tests for asStream — destroy() while a write is awaiting paused,
// plus error propagation from user fn.

test.asPromise('asStream: destroy() unblocks a write waiting on paused', (t, resolve) => {
  // hwm=1, no consumer reading → second write hits push(false) → paused.
  // Without destroy() calling resume(), the write callback would never fire.
  const stream = asStream(x => x, {highWaterMark: 1});
  stream.pause();

  stream.write('a', null, () => {});
  let bCallbackFired = false;
  stream.write('b', null, () => { bCallbackFired = true; });

  setTimeout(() => stream.destroy(), 20);

  // Wait long enough for destroy to drain + tick.
  setTimeout(() => {
    t.ok(bCallbackFired, 'destroy() must release the pending paused write');
    resolve();
  }, 100);
});

test.asPromise('asStream: thrown error in fn emits error event', (t, resolve) => {
  const stream = asStream(x => {
    if (x === 2) throw new Error('boom');
    return x;
  });
  stream.resume(); // drain

  let observed = null;
  stream.on('error', e => { observed = e; });
  stream.on('close', () => {
    t.ok(observed, 'error event fired');
    t.equal(observed?.message, 'boom');
    resolve();
  });

  stream.write(1);
  stream.write(2);
});
