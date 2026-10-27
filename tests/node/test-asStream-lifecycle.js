'use strict';

import test from 'tape-six';

import {Readable} from 'node:stream';

import chain from '../../src/index.js';
import asStream from '../../src/asStream.js';
import gen from '../../src/gen.js';
import {none, stop, Stop, flushable} from '../../src/defs.js';
import take from '../../src/utils/take.js';

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

test.asPromise(
  'asStream: after a stop, a failing generator cleanup surfaces alone',
  (t, resolve) => {
    const cleanupErr = new Error('cleanup boom');
    const stream = asStream(function* (x) {
      try {
        yield x;
        yield stop;
      } finally {
        throw cleanupErr;
      }
    });
    stream.on('data', () => {});
    stream.on('error', error => {
      t.equal(error, cleanupErr, 'the cleanup error, not an AggregateError holding Stop');
      resolve();
    });
    stream.end(1);
  }
);

test.asPromise(
  'asStream: destroy() stops a generator whose values are all dropped',
  (t, resolve) => {
    const state = {produced: 0, released: false};
    let open;
    const gate = new Promise(r => (open = r));
    // the stage holds the first value, then drops it and every later one
    const stream = asStream(gen(makeSource(state, true), () => gate.then(() => none)));
    stream.write(1);
    setTimeout(() => {
      stream.destroy();
      open();
      setTimeout(() => {
        t.equal(state.produced, 1, 'the generator stops at its next yield');
        t.ok(state.released, "generator's finally ran");
        resolve();
      }, 50);
    }, 20);
  }
);

test.asPromise(
  'asStream: destroy() stops a single generator whose values are all dropped',
  (t, resolve) => {
    const state = {produced: 0, released: false};
    let open;
    const gate = new Promise(r => (open = r));
    const stream = asStream(async function* (x) {
      try {
        yield x;
        await gate;
        for (let i = 0; i < 10000; ++i) {
          ++state.produced;
          yield null;
        }
      } finally {
        state.released = true;
      }
    });
    stream.on('data', () => {});
    stream.write(1);
    setTimeout(() => {
      stream.destroy();
      open();
      setTimeout(() => {
        t.equal(state.produced, 1, 'the generator stops at its next yield');
        t.ok(state.released, "generator's finally ran");
        resolve();
      }, 50);
    }, 20);
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

test.asPromise('asStream: destroy() before the end aborts a stage once', (t, resolve) => {
  const {state, stage} = makeCountingStage();
  const stream = asStream(gen(x => x, stage));
  stream.on('data', () => {});
  stream.on('close', () => {
    t.equal(state.aborted, 1, 'aborted once');
    t.equal(state.flushed, 0, 'not flushed');
    resolve();
  });
  stream.write(1);
  setTimeout(() => stream.destroy(), 20);
});

test.asPromise('asStream: a clean end flushes and never aborts', (t, resolve) => {
  const {state, stage} = makeCountingStage();
  const stream = asStream(gen(x => x, stage));
  stream.on('data', () => {});
  stream.on('close', () => {
    t.equal(state.flushed, 1, 'flushed once');
    t.equal(state.aborted, 0, 'not aborted');
    resolve();
  });
  stream.end(1);
});

test.asPromise(
  'asStream: a stop flushes the stages after it and aborts those before',
  (t, resolve) => {
    const up = makeCountingStage();
    let downFlushed = 0;
    const down = flushable(
      x => x,
      () => (++downFlushed, 'tail')
    );
    const stream = asStream(gen(up.stage, x => (x === 2 ? stop : x), down));
    const output = [];
    stream.on('data', value => output.push(value));
    stream.on('end', () => {
      t.deepEqual(output, [1, 'tail'], "the flushed stage's output still reaches the reader");
      t.equal(downFlushed, 1, 'the stage after the stopper is flushed once');
      t.equal(up.state.flushed, 0, 'the stage before the stopper is not flushed');
      t.equal(up.state.aborted, 1, 'it is aborted once');
      resolve();
    });
    stream.write(1);
    stream.write(2);
    stream.end(3);
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
  'asStream: a stop during the flush flushes the stages after it once',
  async (t, resolve) => {
    for (const [name, makeStopper] of Object.entries(flushStoppers)) {
      const down = makeCountingStage(),
        tail = makeCountingStage(null, 'tail');
      const stream = asStream(gen(tail.stage, makeStopper(), down.stage));
      const output = [];
      stream.on('data', value => output.push(value));
      await new Promise((res, rej) => {
        stream.on('end', res);
        stream.on('error', rej);
        stream.end(1);
      });
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
  'asStream: destroy() during the flush aborts the stages not flushed yet',
  async (t, resolve) => {
    const flushed = makeCountingStage(null, 'tail'),
      pending = makePendingStage();
    const stream = asStream(gen(flushed.stage, pending.stage));
    stream.on('data', () => {});
    const closed = new Promise(res => stream.on('close', res));
    stream.end(1);
    await pending.started;
    stream.destroy();
    await closed;
    pending.finish();
    t.equal(flushed.state.flushed, 1, 'the first stage was flushed');
    t.equal(flushed.state.aborted, 0, 'so it is not aborted');
    t.equal(pending.state.aborted, 1, 'a stage whose final is still running is aborted once');
    resolve();
  }
);

test.asPromise(
  'asStream: an error during the flush aborts the stages not flushed',
  async (t, resolve) => {
    const boom = new Error('boom');
    const flushed = makeCountingStage(null, 'tail'),
      failing = makeFailingStage(boom),
      after = makeCountingStage();
    const stream = asStream(gen(flushed.stage, failing.stage, after.stage));
    stream.on('data', () => {});
    const closed = new Promise(res => stream.on('close', res));
    const error = await new Promise(res => {
      stream.on('error', res);
      stream.end(1);
    });
    await closed;
    t.equal(error, boom, 'the error surfaces');
    t.equal(flushed.state.aborted, 0, 'a stage whose final completed is not aborted');
    t.equal(failing.state.aborted, 1, 'a stage whose final threw is aborted once');
    t.equal(after.state.flushed, 0, 'the stage after it was not flushed');
    t.equal(after.state.aborted, 1, 'so it is aborted once');
    resolve();
  }
);

test.asPromise('asStream: a failing abort after a stop is not called again', async (t, resolve) => {
  const abortErr = new Error('abort boom');
  const up = makeCountingStage(() => {
      throw abortErr;
    }),
    down = makeCountingStage();
  const stream = asStream(gen(up.stage, x => (x === 2 ? stop : x), down.stage));
  stream.on('data', () => {});
  const closed = new Promise(res => stream.on('close', res));
  const error = await new Promise(res => {
    stream.on('error', res);
    stream.write(1);
    stream.write(2);
  });
  await closed;
  t.equal(error, abortErr, 'the cleanup error surfaces');
  t.equal(up.state.aborted, 1, 'the failing stage is aborted once');
  t.equal(down.state.flushed, 1, 'the stage after the stopper was flushed');
  t.equal(down.state.aborted, 0, 'so it is not aborted');
  resolve();
});

// A stop's use on an endless source: holding the end until the input ends (tried
// 2026-10-26) passed every other test and read this input to its end.
test('chain: a stop ends the output long before a large input ends', async t => {
  const total = 100000;
  let i = 0;
  const source = new Readable({
    objectMode: true,
    read() {
      setImmediate(() => this.push(i < total ? i++ : null));
    }
  });
  const c = chain([take(2, stop)]);
  source.pipe(c);
  const out = [];
  for await (const x of c) out.push(x);
  source.destroy();
  t.deepEqual(out, [0, 1], 'the values before the stop');
  t.ok(i < 100, `the output ended after ${i} of ${total} input values`);
});

test.asPromise(
  "chain: another copy's Stop ends the stream like this copy's",
  async (t, resolve) => {
    class ForeignStop extends Error {}
    ForeignStop.prototype[Symbol.for('object-stream.stopError')] = 1;
    const c = chain([
      x => {
        if (x === 3) throw new ForeignStop();
        return x;
      }
    ]);
    const out = [];
    const error = await new Promise(res => {
      c.on('data', x => out.push(x));
      c.on('end', () => res(null));
      c.on('error', res);
      for (const x of [1, 2, 3, 4]) c.write(x);
      c.end();
    });
    t.equal(error, null, 'no error');
    t.deepEqual(out, [1, 2], 'the values before the stop');
    resolve();
  }
);
