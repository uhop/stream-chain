'use strict';

// Direct-consumption tests for fun() — calling `fun(...)(value)` and inspecting
// the returned Many. The existing test-fun.js drives fun() through a chain,
// which unwraps its .fList and never calls fun's own `g`; these exercise that
// `g` adapter (now backed by exec.next) directly.

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import {none, finalValue, many, stop, flushable, getManyValues, Stop} from '../../src/defs.js';

import fun from '../../src/fun.js';

const drain = async (f, x) => {
  const r = f(x);
  const m = r && typeof r.then == 'function' ? await r : r;
  return [...getManyValues(m)];
};

test.asPromise('fun direct: smoke', async (t, resolve) => {
  t.deepEqual(
    await drain(
      fun(
        x => x * x,
        x => 2 * x + 1
      ),
      2
    ),
    [9]
  );
  resolve();
});

test.asPromise('fun direct: final short-circuits', async (t, resolve) => {
  t.deepEqual(
    await drain(
      fun(
        x => x * x,
        x => finalValue(x),
        x => 2 * x + 1
      ),
      2
    ),
    [4]
  );
  resolve();
});

test.asPromise('fun direct: none drops', async (t, resolve) => {
  t.deepEqual(
    await drain(
      fun(
        x => x * x,
        () => none,
        x => 2 * x + 1
      ),
      2
    ),
    []
  );
  resolve();
});

test.asPromise('fun direct: generator (sync — stays sync)', async (t, resolve) => {
  const f = fun(
    x => x * x,
    function* (x) {
      yield x;
      yield x + 1;
    },
    x => 2 * x + 1
  );
  const r = f(2);
  t.notOk(
    r && typeof r.then == 'function',
    'sync generator → returned synchronously, not a promise'
  );
  t.deepEqual([...getManyValues(r)], [9, 11]);
  resolve();
});

test.asPromise('fun direct: many', async (t, resolve) => {
  t.deepEqual(
    await drain(
      fun(
        x => x * x,
        x => many([x, x + 1]),
        x => 2 * x + 1
      ),
      2
    ),
    [9, 11]
  );
  resolve();
});

test.asPromise('fun direct: async fn', async (t, resolve) => {
  t.deepEqual(
    await drain(
      fun(
        delay(x => x * x),
        x => 2 * x + 1
      ),
      2
    ),
    [9]
  );
  resolve();
});

test.asPromise('fun direct: flush emits buffered remainder', async (t, resolve) => {
  const batchBy = n => {
    let buf = [];
    return flushable(x => {
      if (x === none) {
        const out = buf;
        buf = [];
        return out.length ? many(out) : none;
      }
      buf.push(x);
      if (buf.length >= n) {
        const out = buf;
        buf = [];
        return many(out);
      }
      return none;
    });
  };
  const f = fun(batchBy(3));
  t.deepEqual(await drain(f, 1), [], 'buffered');
  t.deepEqual(await drain(f, 2), [], 'buffered');
  t.deepEqual(await drain(f, none), [1, 2], 'flush emits remainder');
  resolve();
});

test.asPromise('fun direct: stop halts (no flush — aligned with gen)', async (t, resolve) => {
  const f = fun(x => (x === 2 ? stop : x));
  t.deepEqual(await drain(f, 1), [1]);
  let threw = false;
  try {
    await drain(f, 2);
  } catch (e) {
    threw = e instanceof Stop;
  }
  t.ok(threw, 'threw Stop');
  resolve();
});
