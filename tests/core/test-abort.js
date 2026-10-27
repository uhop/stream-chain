'use strict';

import test from 'tape-six';

import {flushable, none, stop, Stop, abortSymbol} from '../../src/defs.js';
import gen from '../../src/gen.js';
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

test.asPromise('gen: a stop aborts instead of flushing', async (t, resolve) => {
  const {state, stage} = makeStage();
  let caught;
  try {
    await drain(pipe(source, x => (x === 2 ? stop : x), stage)(0));
  } catch (error) {
    caught = error;
  }
  t.ok(caught instanceof Stop, 'Stop propagates, as from any functional pipeline');
  t.deepEqual(state.seen, [1]);
  t.equal(state.aborted, 1, 'aborted once');
  t.equal(state.flushed, 0, 'not flushed');
  resolve();
});

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
