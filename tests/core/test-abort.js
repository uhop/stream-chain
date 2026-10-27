'use strict';

import test from 'tape-six';

import {flushable, none, stop, Stop, many, abortSymbol} from '../../src/defs.js';
import gen from '../../src/gen.js';
import fun from '../../src/fun.js';
import exec from '../../src/exec.js';
import pipe from '../../src/utils/pipe.js';
import take from '../../src/utils/take.js';
import drain from '../../src/utils/drain.js';

// A pass-through flushable that counts its flushes and aborts; its final emits `tail`.
const makeStage = (abort, tail = none) => {
  const state = {seen: [], flushed: 0, aborted: 0};
  const stage = flushable(
    value => {
      state.seen.push(value);
      return value;
    },
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

const source = function* () {
  yield 1;
  yield 2;
  yield 3;
};

test('flushable: keeps an abort function under abortSymbol', t => {
  const abort = () => {};
  t.equal(flushable(x => x, null, abort)[abortSymbol], abort);
  t.equal(flushable(x => x)[abortSymbol], undefined);
});

test.asPromise('gen: a clean pipe flushes and never aborts', async (t, resolve) => {
  const {state, stage} = makeStage();
  await drain(pipe(source, stage)(0));
  t.deepEqual(state.seen, [1, 2, 3]);
  t.equal(state.flushed, 1, 'flushed once');
  t.equal(state.aborted, 0, 'not aborted');
  resolve();
});

test.asPromise('gen: a failing stage aborts once, and its error propagates', async (t, resolve) => {
  const {state, stage} = makeStage();
  const boom = new Error('boom');
  let caught;
  try {
    await drain(
      pipe(function* () {
        yield 1;
        throw boom;
      }, stage)(0)
    );
  } catch (error) {
    caught = error;
  }
  t.equal(caught, boom, 'the stage error propagates');
  t.equal(state.aborted, 1, 'aborted once');
  t.equal(state.flushed, 0, 'not flushed');
  resolve();
});

test.asPromise(
  'gen: a stop flushes the stages after it and aborts those before',
  async (t, resolve) => {
    const up = makeStage(),
      down = makeStage();
    let caught;
    try {
      await drain(pipe(source, up.stage, x => (x === 2 ? stop : x), down.stage)(0));
    } catch (error) {
      caught = error;
    }
    t.equal(caught, undefined, 'drain() ends the pipe() run at its stop');
    t.deepEqual(down.state.seen, [1]);
    t.equal(down.state.flushed, 1, 'the stage after the stopper is flushed');
    t.equal(down.state.aborted, 0, 'and not aborted');
    t.deepEqual(up.state.seen, [1, 2]);
    t.equal(up.state.flushed, 0, 'the stage before the stopper is not flushed');
    t.equal(up.state.aborted, 1, 'it is aborted once');
    resolve();
  }
);

test.asPromise(
  'fun: the flush after a stop covers only the stages after it',
  async (t, resolve) => {
    const up = makeStage(),
      down = makeStage();
    const f = fun(up.stage, x => (x === 2 ? stop : x), down.stage);
    f(1);
    t.throws(() => f(2), 'the stop reaches the caller');
    f(none);
    t.equal(down.state.flushed, 1, 'the stage after the stopper is flushed');
    t.equal(up.state.flushed, 0, 'the stage before it is not');
    resolve();
  }
);

test.asPromise(
  'exec: the flush after a stop covers only the stages after it',
  async (t, resolve) => {
    const up = makeStage(),
      down = makeStage();
    const g = exec(up.stage, x => (x === 2 ? stop : x), down.stage);
    const push = () => {};
    g(1, push);
    t.throws(() => g(2, push), 'the stop reaches the caller');
    g(none, push);
    t.equal(down.state.flushed, 1, 'the stage after the stopper is flushed');
    t.equal(up.state.flushed, 0, 'the stage before it is not');
    resolve();
  }
);

test.asPromise('gen: breaking out aborts once', async (t, resolve) => {
  const {state, stage} = makeStage();
  for await (const _ of gen(source, stage)(0)) break;
  t.equal(state.aborted, 1, 'aborted once');
  t.equal(state.flushed, 0, 'not flushed');
  resolve();
});

test.asPromise('gen: a failing abort surfaces', async (t, resolve) => {
  const abortErr = new Error('abort boom');
  const {stage} = makeStage(() => {
    throw abortErr;
  });
  let caught;
  try {
    for await (const _ of gen(source, stage)(0)) break;
  } catch (error) {
    caught = error;
  }
  t.equal(caught, abortErr, 'the break surfaces the abort failure');

  const boom = new Error('boom');
  const {stage: stage2} = makeStage(() => Promise.reject(abortErr));
  caught = null;
  try {
    await drain(
      pipe(function* () {
        yield 1;
        throw boom;
      }, stage2)(0)
    );
  } catch (error) {
    caught = error;
  }
  t.ok(caught instanceof AggregateError, 'after a stage error, both surface');
  t.deepEqual(caught?.errors, [boom, abortErr], 'stage error first');
  resolve();
});

// A Stop thrown by a stage is the same as the stage returning `stop`.
const throwers = {
  'a function': x => {
    if (x === 2) throw new Stop();
    return x;
  },
  'an async function': async x => {
    if (x === 2) throw new Stop();
    return x;
  },
  'a generator': function* (x) {
    if (x === 2) throw new Stop();
    yield x;
  },
  'an async generator': async function* (x) {
    if (x === 2) throw new Stop();
    yield x;
  }
};

const stopsAt = async fn => {
  const up = makeStage(),
    down = makeStage();
  let caught;
  try {
    await drain(fn(up.stage, down.stage));
  } catch (error) {
    caught = error;
  }
  return {caught, up: up.state, down: down.state};
};

test.asPromise('gen: a thrown Stop flushes the stages after the thrower', async (t, resolve) => {
  for (const [name, thrower] of Object.entries(throwers)) {
    const {caught, up, down} = await stopsAt((up, down) => pipe(source, up, thrower, down)(0));
    t.equal(caught, undefined, name + ': drain() ends the pipe() run at its stop');
    t.deepEqual(down.seen, [1], name + ': data before the stop reached the stage after');
    t.equal(down.flushed, 1, name + ': the stage after the thrower is flushed');
    t.equal(down.aborted, 0, name + ': and not aborted');
    t.equal(up.flushed, 0, name + ': the stage before the thrower is not flushed');
    t.equal(up.aborted, 1, name + ': it is aborted once');
  }
  resolve();
});

test.asPromise(
  'gen: a stop leaving a nested pipe() stops at the pipe stage',
  async (t, resolve) => {
    const stopper = x => (x === 2 ? stop : x);
    let r = await stopsAt((up, down) =>
      pipe(
        source,
        up,
        pipe(
          x => x,
          x => x,
          x => x,
          stopper
        ),
        down
      )(0)
    );
    t.equal(r.down.flushed, 1, 'a longer inner pipeline: the stage after the pipe is flushed');
    t.equal(r.down.aborted, 0, 'and not aborted');
    t.equal(r.up.aborted, 1, 'the stage before the pipe is aborted');

    r = await stopsAt((up, down) =>
      pipe(
        source,
        up,
        x => x,
        x => x,
        pipe(stopper),
        down
      )(0)
    );
    t.equal(r.up.flushed, 0, 'a shorter inner pipeline: the stage before the pipe is not flushed');
    t.equal(r.up.aborted, 1, 'it is aborted once');
    t.equal(r.down.flushed, 1, 'the stage after the pipe is flushed');

    const inner = fun(stopper);
    r = await stopsAt((up, down) =>
      pipe(
        source,
        up,
        x => x,
        x => inner(x),
        down
      )(0)
    );
    t.equal(r.up.flushed, 0, 'a wrapped fun(): the stage before the wrapper is not flushed');
    t.equal(r.up.aborted, 1, 'it is aborted once');
    t.equal(r.down.flushed, 1, 'the stage after the wrapper is flushed');
    resolve();
  }
);

// Stoppers that refuse the tail a flushable emits from its final.
const flushStoppers = {
  'take(n, stop)': () => take(1, stop),
  'a thrown Stop': () => x => {
    if (x === 'tail') throw new Stop();
    return x;
  }
};

test.asPromise('gen: a stop during the flush flushes the stages after it', async (t, resolve) => {
  for (const [name, makeStopper] of Object.entries(flushStoppers)) {
    const tail = makeStage(null, 'tail'),
      down = makeStage();
    let caught;
    try {
      await drain(pipe(tail.stage, makeStopper(), down.stage)(1));
    } catch (error) {
      caught = error;
    }
    t.equal(caught, undefined, name + ': drain() ends the pipe() run at its stop');
    t.equal(tail.state.flushed, 1, name + ': the stage before the stopper was flushed');
    t.equal(tail.state.aborted, 0, name + ': and, flushed, it is not aborted');
    t.deepEqual(down.state.seen, [1], name + ': the tail stopped at the stopper');
    t.equal(down.state.flushed, 1, name + ': the stage after the stopper is flushed');
    t.equal(down.state.aborted, 0, name + ': and not aborted');
  }
  resolve();
});

test('fun and exec: a stop during the flush flushes the stages after it', t => {
  for (const [name, makeStopper] of Object.entries(flushStoppers)) {
    let down = makeStage();
    const f = fun(makeStage(null, 'tail').stage, makeStopper(), down.stage);
    f(1);
    t.throws(() => f(none), name + ': fun: the stop reaches the caller');
    t.equal(down.state.flushed, 1, name + ': fun: the stage after the stopper is flushed');

    down = makeStage();
    const g = exec(makeStage(null, 'tail').stage, makeStopper(), down.stage);
    const push = () => {};
    g(1, push);
    t.throws(() => g(none, push), name + ': exec: the stop reaches the caller');
    t.equal(down.state.flushed, 1, name + ': exec: the stage after the stopper is flushed');
  }
});

// Each flushable gets its final or its abort, once: never an abort after its own
// final completed, and never two.
test.asPromise(
  'gen: a stop in the data pass and another in the flush release each stage once',
  async (t, resolve) => {
    const up = makeStage(),
      mid = makeStage(null, 'tail'),
      down = makeStage();
    let caught;
    try {
      await drain(
        pipe(
          source,
          up.stage,
          x => (x === 2 ? stop : x),
          mid.stage,
          x => (x === 'tail' ? stop : x),
          down.stage
        )(0)
      );
    } catch (error) {
      caught = error;
    }
    t.equal(caught, undefined, 'drain() ends the pipe() run at its stop');
    t.equal(up.state.aborted, 1, 'the stage before the first stopper is aborted once');
    t.equal(up.state.flushed, 0, 'and not flushed');
    t.equal(mid.state.flushed, 1, 'the stage between the stoppers is flushed');
    t.equal(mid.state.aborted, 0, 'and not aborted after its final');
    t.equal(down.state.flushed, 1, 'the stage after the second stopper is flushed');
    t.equal(down.state.aborted, 0, 'and not aborted');
    resolve();
  }
);

test.asPromise(
  'gen: a break during the flush aborts the stages not flushed yet',
  async (t, resolve) => {
    // several tail values, so the break lands before the second stage's final (gen()
    // runs its producer one value ahead of the consumer)
    const flushed = makeStage(null, many(['t1', 't2', 't3'])),
      pending = makeStage();
    for await (const value of pipe(flushed.stage, pending.stage)(1)) {
      if (value === 't1') break;
    }
    t.equal(flushed.state.flushed, 1, 'the first stage was flushed');
    t.equal(flushed.state.aborted, 0, 'so it is not aborted');
    t.equal(pending.state.flushed, 0, 'the break came before the second stage was flushed');
    t.equal(pending.state.aborted, 1, 'so it is aborted once');
    resolve();
  }
);

test.asPromise(
  'gen: an error during the flush aborts the stages not flushed',
  async (t, resolve) => {
    const boom = new Error('boom');
    const flushed = makeStage(null, 'tail'),
      failing = {aborted: 0},
      after = makeStage();
    const failingStage = flushable(
      x => x,
      () => {
        throw boom;
      },
      () => {
        ++failing.aborted;
      }
    );
    let caught;
    try {
      await drain(pipe(flushed.stage, failingStage, after.stage)(1));
    } catch (error) {
      caught = error;
    }
    t.equal(caught, boom, 'the error propagates');
    t.equal(flushed.state.aborted, 0, 'a stage whose final completed is not aborted');
    t.equal(failing.aborted, 1, 'a stage whose final threw is aborted once');
    t.equal(after.state.flushed, 0, 'the stage after it was not flushed');
    t.equal(after.state.aborted, 1, 'so it is aborted once');
    resolve();
  }
);

test.asPromise(
  'pipe: a failing release after a stop still flushes the stages after the stopper',
  async (t, resolve) => {
    const abortErr = new Error('abort boom');
    const up = makeStage(() => {
        throw abortErr;
      }),
      down = makeStage();
    let caught;
    try {
      await drain(pipe(source, up.stage, x => (x === 2 ? stop : x), down.stage)(0));
    } catch (error) {
      caught = error;
    }
    t.equal(caught, abortErr, 'the cleanup error surfaces in place of the Stop');
    t.equal(up.state.aborted, 1, 'the failing stage is aborted once');
    t.equal(down.state.flushed, 1, 'the stage after the stopper was flushed first');
    t.equal(down.state.aborted, 0, 'so it is not aborted');
    resolve();
  }
);

// Plain gen() releases at the end of its data pass, and no flush follows a failure.
test.asPromise(
  'gen: a failing release after a stop releases the stages after the stopper',
  async (t, resolve) => {
    const abortErr = new Error('abort boom');
    const up = makeStage(() => {
        throw abortErr;
      }),
      down = makeStage();
    let caught;
    try {
      await drain(gen(source, up.stage, x => (x === 2 ? stop : x), down.stage)(0));
    } catch (error) {
      caught = error;
    }
    t.equal(caught, abortErr, 'the cleanup error surfaces in place of the Stop');
    t.equal(up.state.aborted, 1, 'the failing stage is aborted once');
    t.equal(down.state.flushed, 0, 'no flush follows a failure');
    t.equal(down.state.aborted, 1, 'so the stage after the stopper is aborted once');
    resolve();
  }
);
