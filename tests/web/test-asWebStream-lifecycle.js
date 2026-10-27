'use strict';

import test from 'tape-six';

import asWebStream from '../../src/asWebStream.js';
import gen from '../../src/gen.js';
import {none, stop, Stop, flushable} from '../../src/defs.js';
import take from '../../src/utils/take.js';

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

test.asPromise(
  'asWebStream: after a stop, a failing generator cleanup surfaces alone',
  async (t, resolve) => {
    const cleanupErr = new Error('cleanup boom');
    const ws = asWebStream(function* (x) {
      try {
        yield x;
        yield stop;
      } finally {
        throw cleanupErr;
      }
    });
    const writer = ws.writable.getWriter();
    const written = writer.write(1).catch(error => error);
    writer.close().catch(() => {});
    let caught;
    try {
      for await (const _ of ws.readable);
    } catch (error) {
      caught = error;
    }
    t.equal(caught, cleanupErr, 'the readable side fails with the cleanup error');
    t.equal(await written, cleanupErr, 'and so does the write');
    resolve();
  }
);

test.asPromise(
  'asWebStream: reader.cancel() stops a generator whose values are all dropped',
  async (t, resolve) => {
    const state = {produced: 0, released: false};
    let open;
    const gate = new Promise(r => (open = r));
    // the stage holds the first value, then drops it and every later one
    const ws = asWebStream(gen(makeSource(state, true), () => gate.then(() => none)));
    ws.writable
      .getWriter()
      .write(1)
      .catch(() => {});
    await new Promise(r => setTimeout(r, 20));
    await ws.readable.getReader().cancel();
    open();
    await new Promise(r => setTimeout(r, 50));
    t.equal(state.produced, 1, 'the generator stops at its next yield');
    t.ok(state.released, "generator's finally ran");
    resolve();
  }
);

// Counts its flushes and aborts; its final emits `tail`, its abort calls `abort`.
const makeCountingStage = (abort, tail = none) => {
  const state = {flushed: 0, aborted: 0};
  const stage = flushable(
    x => x,
    () => {
      ++state.flushed;
      return tail;
    },
    () => {
      ++state.aborted;
      return abort?.();
    }
  );
  return {state, stage};
};

// A stage whose final stays pending until `finish()`; `started` resolves when it begins.
const makePendingStage = () => {
  const state = {aborted: 0};
  let begin, finish;
  const started = new Promise(resolve => (begin = resolve));
  const stage = flushable(
    x => x,
    () => {
      begin();
      return new Promise(resolve => (finish = resolve)).then(() => none);
    },
    () => {
      ++state.aborted;
    }
  );
  return {state, stage, started, finish: () => finish()};
};

// A stage whose final throws `error`.
const makeFailingStage = error => {
  const state = {aborted: 0};
  const stage = flushable(
    x => x,
    () => {
      throw error;
    },
    () => {
      ++state.aborted;
    }
  );
  return {state, stage};
};

test.asPromise('asWebStream: reader.cancel() aborts a stage once', async (t, resolve) => {
  const {state, stage} = makeCountingStage();
  const ws = asWebStream(gen(x => x, stage));
  ws.writable
    .getWriter()
    .write(1)
    .catch(() => {});
  const reader = ws.readable.getReader();
  await reader.read();
  await reader.cancel();
  t.equal(state.aborted, 1, 'aborted once');
  t.equal(state.flushed, 0, 'not flushed');
  resolve();
});

test.asPromise('asWebStream: a clean close flushes and never aborts', async (t, resolve) => {
  const {state, stage} = makeCountingStage();
  const ws = asWebStream(gen(x => x, stage));
  const writer = ws.writable.getWriter();
  const written = writer.write(1).then(() => writer.close());
  for await (const _ of ws.readable);
  await written;
  t.equal(state.flushed, 1, 'flushed once');
  t.equal(state.aborted, 0, 'not aborted');
  resolve();
});

test.asPromise(
  'asWebStream: a stop flushes the stages after it and aborts those before',
  async (t, resolve) => {
    const up = makeCountingStage();
    let downFlushed = 0;
    const down = flushable(
      x => x,
      () => (++downFlushed, 'tail')
    );
    const ws = asWebStream(gen(up.stage, x => (x === 2 ? stop : x), down));
    const writer = ws.writable.getWriter();
    const written = writer
      .write(1)
      .then(() => writer.write(2))
      .then(() => writer.close());
    const output = [];
    for await (const value of ws.readable) output.push(value);
    await written;
    t.deepEqual(output, [1, 'tail'], "the flushed stage's output still reaches the reader");
    t.equal(downFlushed, 1, 'the stage after the stopper is flushed once');
    t.equal(up.state.flushed, 0, 'the stage before the stopper is not flushed');
    t.equal(up.state.aborted, 1, 'it is aborted once');
    resolve();
  }
);

// A flushable whose final emits a tail, and stoppers that refuse that tail.
const flushStoppers = {
  'take(n, stop)': () => take(1, stop),
  'a thrown Stop': () => x => {
    if (x === 'tail') throw new Stop();
    return x;
  }
};

test.asPromise(
  'asWebStream: a stop during the flush flushes the stages after it once',
  async (t, resolve) => {
    for (const [name, makeStopper] of Object.entries(flushStoppers)) {
      const down = makeCountingStage(),
        tail = makeCountingStage(null, 'tail');
      const ws = asWebStream(gen(tail.stage, makeStopper(), down.stage));
      const writer = ws.writable.getWriter();
      const written = writer.write(1).then(() => writer.close());
      const output = [];
      for await (const value of ws.readable) output.push(value);
      await written;
      t.deepEqual(output, [1], name + ': the tail stopped at the stopper');
      t.equal(down.state.flushed, 1, name + ': the stage after the stopper is flushed once');
      t.equal(down.state.aborted, 0, name + ': and not aborted');
      t.equal(tail.state.aborted, 0, name + ': the flushed stage before it is not aborted');
    }
    resolve();
  }
);

// Each flushable gets its final or its abort, once: never an abort after its own
// final completed, and never two.
test.asPromise(
  'asWebStream: readable.cancel() during the flush aborts the stages not flushed yet',
  async (t, resolve) => {
    const flushed = makeCountingStage(null, 'tail'),
      pending = makePendingStage();
    const ws = asWebStream(gen(flushed.stage, pending.stage));
    const writer = ws.writable.getWriter(),
      reader = ws.readable.getReader();
    const written = writer
      .write(1)
      .then(() => writer.close())
      .catch(() => {});
    const reading = (async () => {
      for (;;) if ((await reader.read()).done) break;
    })().catch(() => {});
    await pending.started;
    await reader.cancel('done reading');
    pending.finish();
    await Promise.all([written, reading]);
    t.equal(flushed.state.flushed, 1, 'the first stage was flushed');
    t.equal(flushed.state.aborted, 0, 'so it is not aborted');
    t.equal(pending.state.aborted, 1, 'a stage whose final is still running is aborted once');
    resolve();
  }
);

test.asPromise(
  'asWebStream: an error during the flush aborts the stages not flushed',
  async (t, resolve) => {
    const boom = new Error('boom');
    const flushed = makeCountingStage(null, 'tail'),
      failing = makeFailingStage(boom),
      after = makeCountingStage();
    const ws = asWebStream(gen(flushed.stage, failing.stage, after.stage));
    const writer = ws.writable.getWriter();
    const reading = (async () => {
      for await (const _ of ws.readable);
    })().catch(() => {});
    let caught;
    try {
      await writer.write(1);
      await writer.close();
    } catch (error) {
      caught = error;
    }
    await reading;
    t.equal(caught, boom, 'the error surfaces');
    t.equal(flushed.state.aborted, 0, 'a stage whose final completed is not aborted');
    t.equal(failing.state.aborted, 1, 'a stage whose final threw is aborted once');
    t.equal(after.state.flushed, 0, 'the stage after it was not flushed');
    t.equal(after.state.aborted, 1, 'so it is aborted once');
    resolve();
  }
);

test.asPromise(
  'asWebStream: an error in the flush after a stop releases the stages after it',
  async (t, resolve) => {
    const boom = new Error('boom');
    const failing = makeFailingStage(boom),
      after = makeCountingStage();
    const ws = asWebStream(gen(x => (x === 2 ? stop : x), failing.stage, after.stage));
    const writer = ws.writable.getWriter();
    const reading = (async () => {
      for await (const _ of ws.readable);
    })().catch(() => {});
    let caught;
    try {
      await writer.write(1);
      await writer.write(2);
    } catch (error) {
      caught = error;
    }
    await reading;
    t.equal(caught, boom, 'the error surfaces');
    t.equal(failing.state.aborted, 1, 'a stage whose final threw is aborted once');
    t.equal(after.state.flushed, 0, 'the stage after it was not flushed');
    t.equal(after.state.aborted, 1, 'so it is aborted once');
    resolve();
  }
);
