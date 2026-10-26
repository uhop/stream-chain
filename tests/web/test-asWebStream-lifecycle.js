'use strict';

import test from 'tape-six';

import asWebStream from '../../src/asWebStream.js';
import gen from '../../src/gen.js';
import {none, stop} from '../../src/defs.js';

// Lifecycle/error-propagation tests. Cover writer.abort(), reader.cancel(),
// and user-function errors — all should match TransformStream-shape behavior.

test.asPromise('asWebStream: writer.abort() unblocks pending drain', async (t, resolve) => {
  // hwm=1; first write enqueues, hits desiredSize=0, returns Promise (pendingDrain).
  // Nothing reads → pendingDrain only resolves if abort signals it.
  const ws = asWebStream(x => x);
  const writer = ws.writable.getWriter();
  const writePromise = writer.write('a');

  // Give the write a tick to enter the awaiting-drain state, then abort.
  await new Promise(r => setTimeout(r, 10));
  writer.abort(new Error('cancelled')).catch(() => {});

  // Without the controller.signal listener, writePromise would hang forever.
  const settled = await Promise.race([
    writePromise.then(
      () => 'resolved',
      e => 'rejected:' + (e?.message ?? e)
    ),
    new Promise(r => setTimeout(() => r('HANG'), 200))
  ]);
  t.notEqual(settled, 'HANG', 'pending write must settle, not hang');
  resolve();
});

test.asPromise('asWebStream: reader.cancel() propagates error to writable', async (t, resolve) => {
  // Matches TransformStream: when the consumer gives up, the producer's next
  // write rejects so they learn the pipeline is gone.
  const ws = asWebStream(x => x);
  const writer = ws.writable.getWriter();
  const reader = ws.readable.getReader();

  const producer = (async () => {
    await writer.write(1);
    await reader.cancel(new Error('consumer done'));
    try {
      await writer.write(2);
      return null;
    } catch (e) {
      return e?.message ?? e;
    }
  })();
  await reader.read(); // drain the first value so write(1) can settle

  const reason = await producer;
  t.equal(reason, 'consumer done', 'producer learns the cancel reason');
  resolve();
});

test.asPromise('asWebStream: error in fn errors the readable side', async (t, resolve) => {
  // User-function throws → both sides error (TransformStream parity). Without
  // this, a downstream pipeTo would hang awaiting a readable that never
  // closes.
  const ws = asWebStream(x => {
    if (x === 2) throw new Error('boom');
    return x;
  });
  const writer = ws.writable.getWriter();
  const reader = ws.readable.getReader();

  // Producer keeps feeding; we only care that the reader observes the error.
  writer.write(1).catch(() => {});
  writer.write(2).catch(() => {});

  await reader.read(); // value 1
  try {
    await reader.read();
    t.fail('reader.read() should reject after fn throws');
  } catch (e) {
    t.equal(e?.message, 'boom', 'reader sees the user-function error');
  }
  resolve();
});

test.asPromise('asWebStream: web chain mid-stage error reaches producer', async (t, resolve) => {
  // Composed scenario: 3-stage chain, middle stage throws. The cancel
  // propagation + write-error propagation together carry the error back to
  // the producer's writer.write() call.
  const {default: webChain} = await import('../../src/web/index.js');

  const c = webChain([
    x => x,
    x => {
      if (x === 2) throw new Error('mid-boom');
      return x;
    },
    x => x
  ]);
  const writer = c.writable.getWriter();
  const reader = c.readable.getReader();

  // Drain the readable in parallel so the pipeline can flow.
  const drain = (async () => {
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
      }
    } catch (_) {
      // expected — the chain errors mid-flow
    }
  })();

  let producerError = null;
  try {
    await writer.write(1);
    await writer.write(2);
  } catch (e) {
    producerError = e;
  }
  await drain;

  t.ok(producerError, 'producer must observe an error');
  t.equal(producerError?.message, 'mid-boom', 'error reason matches throwing stage');
  resolve();
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

const cancelWhileSuspended = async (t, fn) => {
  const state = {produced: 0, released: false};
  const ws = asWebStream(fn(state));
  ws.writable
    .getWriter()
    .write(1)
    .catch(() => {});
  // nobody reads → the generator suspends at a backpressured yield
  await new Promise(r => setTimeout(r, 20));
  const before = state.produced;
  await ws.readable.getReader().cancel();
  await new Promise(r => setTimeout(r, 50));
  t.ok(state.produced - before <= 1, 'generator stops within one item of cancel()');
  t.ok(state.released, "generator's finally ran");
};

test.asPromise(
  'asWebStream: reader.cancel() releases a suspended generator',
  async (t, resolve) => {
    await cancelWhileSuspended(t, state => makeSource(state, false));
    resolve();
  }
);

test.asPromise(
  'asWebStream: reader.cancel() releases a suspended generator in gen()',
  async (t, resolve) => {
    await cancelWhileSuspended(t, state =>
      // later values never reach the stream's push again
      gen(makeSource(state, true), x => (x === 1 ? x : none))
    );
    resolve();
  }
);

test.asPromise(
  'asWebStream: reader.cancel() during an async stage releases the generator',
  async (t, resolve) => {
    const state = {produced: 0, released: false};
    let open;
    const gate = new Promise(r => (open = r));
    const ws = asWebStream(gen(makeSource(state, false), x => gate.then(() => x)));
    ws.writable
      .getWriter()
      .write(1) // the stage holds the first value, so nothing waits on a push
      .catch(() => {});
    await new Promise(r => setTimeout(r, 20));
    await ws.readable.getReader().cancel();
    open();
    await new Promise(r => setTimeout(r, 50));
    t.equal(state.produced, 1, 'generator stops after cancel()');
    t.ok(state.released, "generator's finally ran");
    resolve();
  }
);

test.asPromise('asWebStream: stop from a generator releases it', async (t, resolve) => {
  let released = false;
  const ws = asWebStream(function* (x) {
    try {
      yield x;
      yield stop;
    } finally {
      released = true;
    }
  });
  const writer = ws.writable.getWriter();
  writer.write(1).catch(() => {});
  writer.close().catch(() => {});
  const output = [];
  for await (const value of ws.readable) output.push(value);
  t.deepEqual(output, [1]);
  t.ok(released, "generator's finally ran");
  resolve();
});
