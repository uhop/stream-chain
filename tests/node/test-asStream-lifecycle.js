'use strict';

import test from 'tape-six';

import asStream from '../../src/asStream.js';
import gen from '../../src/gen.js';
import {none, stop} from '../../src/defs.js';

// Lifecycle tests for asStream — destroy() while a write is awaiting paused,
// plus error propagation from user fn.

test.asPromise('asStream: destroy() unblocks a write waiting on paused', (t, resolve) => {
  // hwm=1, no consumer reading → second write hits push(false) → paused.
  // Without destroy() calling resume(), the write callback would never fire.
  const stream = asStream(x => x, {highWaterMark: 1});
  stream.pause();

  stream.write('a', null, () => {});
  let bCallbackFired = false;
  stream.write('b', null, () => {
    bCallbackFired = true;
  });

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
  stream.on('error', e => {
    observed = e;
  });
  stream.on('close', () => {
    t.ok(observed, 'error event fired');
    t.equal(observed?.message, 'boom');
    resolve();
  });

  stream.write(1);
  stream.write(2);
});

// Bounded rather than endless so a regression fails instead of hanging the runner.
const makeSource = (state, isAsync) => {
  const body = function* (x) {
    try {
      for (let i = 0; i < 10000; ++i) {
        ++state.produced;
        yield x + i;
      }
    } finally {
      state.released = true;
    }
  };
  if (!isAsync) return body;
  return async function* (x) {
    yield* body(x);
  };
};

const destroyWhileSuspended = (t, resolve, fn) => {
  const state = {produced: 0, released: false};
  const stream = asStream(fn(state), {highWaterMark: 1});
  stream.write(1); // nobody reads → the generator suspends at a backpressured yield
  setTimeout(() => {
    const before = state.produced;
    stream.destroy();
    setTimeout(() => {
      t.ok(state.produced - before <= 1, 'generator stops within one item of destroy()');
      t.ok(state.released, "generator's finally ran");
      resolve();
    }, 50);
  }, 20);
};

test.asPromise('asStream: destroy() releases a suspended generator', (t, resolve) =>
  destroyWhileSuspended(t, resolve, state => makeSource(state, false))
);

test.asPromise('asStream: destroy() releases a suspended generator in gen()', (t, resolve) =>
  destroyWhileSuspended(t, resolve, state =>
    // later values never reach the stream's push again
    gen(makeSource(state, true), x => (x === 1 ? x : none))
  )
);

test.asPromise('asStream: destroy() during an async stage releases the generator', (t, resolve) => {
  const state = {produced: 0, released: false};
  let open;
  const gate = new Promise(r => (open = r));
  const stream = asStream(gen(makeSource(state, false), x => gate.then(() => x)));
  stream.write(1); // the stage holds the first value, so nothing waits on a push
  setTimeout(() => {
    stream.destroy();
    open();
    setTimeout(() => {
      t.equal(state.produced, 1, 'generator stops after destroy()');
      t.ok(state.released, "generator's finally ran");
      resolve();
    }, 50);
  }, 20);
});

test.asPromise('asStream: stop from a generator releases it', (t, resolve) => {
  let released = false;
  const stream = asStream(function* (x) {
    try {
      yield x;
      yield stop;
    } finally {
      released = true;
    }
  });
  const output = [];
  stream.on('data', value => output.push(value));
  stream.on('end', () => {
    t.deepEqual(output, [1]);
    t.ok(released, "generator's finally ran");
    resolve();
  });
  stream.end(1);
});
