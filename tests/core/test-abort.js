'use strict';

import test from 'tape-six';

import {flushable, none, stop, Stop, abortSymbol} from '../../src/defs.js';
import gen from '../../src/gen.js';
import fun from '../../src/fun.js';
import exec from '../../src/exec.js';
import pipe from '../../src/utils/pipe.js';
import drain from '../../src/utils/drain.js';

// A pass-through flushable that counts its flushes and aborts.
const makeStage = abort => {
  const state = {seen: [], flushed: 0, aborted: 0};
  const stage = flushable(
    value => {
      state.seen.push(value);
      return value;
    },
    () => {
      ++state.flushed;
      return none;
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
    t.ok(caught instanceof Stop, 'Stop propagates, as from any functional pipeline');
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
