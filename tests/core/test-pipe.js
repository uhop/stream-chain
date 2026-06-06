'use strict';

import test from 'tape-six';

import {none, stop, flushable, Stop} from '../../src/defs.js';
import pipe from '../../src/utils/pipe.js';

// A flushable sink that records whether its final() ran (stands in for a
// resource-owning sink such as asyncBlockWriter, whose final() closes a
// FileHandle).
const recordingSink = () => {
  const log = {finalRan: false, seen: []};
  const fn = flushable(
    value => {
      log.seen.push(value);
      return none;
    },
    () => {
      log.finalRan = true;
      return none;
    }
  );
  return {fn, log};
};

const drive = async source => {
  const out = [];
  for await (const value of source) out.push(value);
  return out;
};

test.asPromise('pipe: flushes a flushable sink on normal completion', async (t, resolve) => {
  const s = recordingSink();
  await drive(pipe(x => x, s.fn)(7));
  t.ok(s.log.finalRan, 'final() ran');
  t.deepEqual(s.log.seen, [7], 'the value reached the sink');
  resolve();
});

test.asPromise('pipe: flushes the sink even when a stage issues stop', async (t, resolve) => {
  const s = recordingSink();
  let caught = null;
  try {
    await drive(
      pipe(function* (x) {
        yield x;
        yield stop;
      }, s.fn)(7)
    );
  } catch (e) {
    caught = e;
  }
  t.ok(caught instanceof Stop, 'Stop propagated to the consumer');
  t.ok(s.log.finalRan, 'final() still ran on stop (the resource is released, not leaked)');
  resolve();
});

test.asPromise('pipe: flushes the sink when a stage throws', async (t, resolve) => {
  const s = recordingSink();
  const boom = new Error('boom');
  let caught = null;
  try {
    await drive(
      pipe(() => {
        throw boom;
      }, s.fn)(7)
    );
  } catch (e) {
    caught = e;
  }
  t.equal(caught, boom, 'the original error propagates');
  t.ok(s.log.finalRan, 'final() still ran after the throw');
  resolve();
});

test.asPromise('pipe: flushes when the consumer breaks early', async (t, resolve) => {
  const log = {finalRan: false};
  // pass-through flushable so the pipe yields values for the consumer to break on
  const passthrough = flushable(
    value => value,
    () => {
      log.finalRan = true;
      return none;
    }
  );
  for await (const _ of pipe(function* (x) {
    yield x;
    yield x + 1;
    yield x + 2;
  }, passthrough)(1)) {
    break; // take the first, then bail
  }
  t.ok(log.finalRan, 'final() ran after an early break');
  resolve();
});

test.asPromise(
  'pipe: AggregateError when both the data pass and the flush throw',
  async (t, resolve) => {
    const sink = flushable(
      () => none,
      () => {
        throw new Error('flush boom');
      }
    );
    let caught = null;
    try {
      await drive(
        pipe(function* (x) {
          yield x;
          yield stop;
        }, sink)(1)
      );
    } catch (e) {
      caught = e;
    }
    t.ok(caught instanceof AggregateError, 'threw an AggregateError');
    t.equal(caught.errors.length, 2, 'carries both errors');
    t.ok(
      caught.errors.some(e => e instanceof Stop),
      'one of them is the Stop'
    );
    t.ok(
      caught.errors.some(e => e && e.message === 'flush boom'),
      'one of them is the flush error'
    );
    resolve();
  }
);
