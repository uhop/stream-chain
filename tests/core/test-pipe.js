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

// The flush finalizes only a pipeline that COMPLETED. An abort — a stage throws,
// a stage issues `stop`, or the consumer breaks — leaves the generator before
// `g(none)`, so the sink's `final()` does not run. An exception is not
// recoverable: a failed pipeline must not be finalized. (Resource-owning SOURCE
// stages still release inline via the executor's abort path — see
// test-resource-cleanup.js.)
test.asPromise('pipe: does NOT flush when a stage issues stop', async (t, resolve) => {
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
  t.deepEqual(s.log.seen, [7], 'data up to the stop reached the sink');
  t.notOk(s.log.finalRan, 'final() did not run — a stopped pipeline is not finalized');
  resolve();
});

test.asPromise('pipe: does NOT flush when a stage throws', async (t, resolve) => {
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
  t.equal(caught, boom, 'the original error propagates intact');
  t.notOk(s.log.finalRan, 'final() did not run — a failed pipeline is not finalized');
  resolve();
});

test.asPromise('pipe: does NOT flush when the consumer breaks early', async (t, resolve) => {
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
  t.notOk(log.finalRan, 'final() did not run — an abandoned pipeline is not finalized');
  resolve();
});

test.asPromise(
  'pipe: a throwing stateful flushable surfaces its single error, not an AggregateError',
  async (t, resolve) => {
    // Regression guard for the 4.2.3 bug. pipe ran the flush in a `finally`,
    // re-driving a flushable that had already thrown. A stateful stage (like
    // stream-json's jsonVerifier) throws BEFORE consuming its buffer, so the
    // flush re-ran the SAME work over the SAME dirty buffer and threw a second,
    // logically-identical error — surfacing AggregateError([E, E]). With the
    // flush gated on a clean data pass, the failed work runs once and the one
    // real error propagates.
    let runs = 0;
    const verifierLike = () => {
      let buffer = '';
      const processBuffer = () => {
        ++runs;
        if (buffer.includes(' ')) throw new Error('bad token'); // throws; buffer NOT consumed
        buffer = '';
      };
      return flushable(value => {
        if (value === none) {
          processBuffer();
          return none;
        }
        buffer += value;
        processBuffer();
        return none;
      });
    };
    let caught = null;
    try {
      await drive(pipe(verifierLike())('a b'));
    } catch (e) {
      caught = e;
    }
    t.notOk(caught instanceof AggregateError, 'not wrapped in an AggregateError');
    t.equal(caught?.message, 'bad token', 'the one real error propagates');
    t.equal(runs, 1, 'the failed work ran exactly once — the flush did not re-run it');
    resolve();
  }
);
