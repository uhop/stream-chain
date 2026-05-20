'use strict';

import test from 'tape-six';

import asWebStream from '../src/asWebStream.js';

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
    writePromise.then(() => 'resolved', e => 'rejected:' + (e?.message ?? e)),
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
  const {default: webChain} = await import('../src/web/index.js');

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
