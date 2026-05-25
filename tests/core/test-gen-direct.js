'use strict';

// Direct-consumption tests for gen() — iterating `gen(...)(value)` as an async
// iterable. The existing test-gen.js drives gen() through a chain, which unwraps
// its .fList and never iterates gen's own async generator; these exercise that
// `g` directly. Also a regression gate for any future engine swap of gen().

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import {none, finalValue, many, stop, flushable, Stop} from '../../src/defs.js';

import gen from '../../src/gen.js';

const drain = async (g, x) => {
  const out = [];
  for await (const v of g(x)) out.push(v);
  return out;
};

test.asPromise('gen direct: smoke', async (t, resolve) => {
  t.deepEqual(
    await drain(
      gen(
        x => x * x,
        x => 2 * x + 1
      ),
      2
    ),
    [9]
  );
  resolve();
});

test.asPromise('gen direct: final short-circuits', async (t, resolve) => {
  t.deepEqual(
    await drain(
      gen(
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

test.asPromise('gen direct: none drops', async (t, resolve) => {
  t.deepEqual(
    await drain(
      gen(
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

test.asPromise('gen direct: generator', async (t, resolve) => {
  const g = gen(
    x => x * x,
    function* (x) {
      yield x;
      yield x + 1;
    },
    x => 2 * x + 1
  );
  t.deepEqual(await drain(g, 2), [9, 11]);
  resolve();
});

test.asPromise('gen direct: many', async (t, resolve) => {
  t.deepEqual(
    await drain(
      gen(
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

test.asPromise('gen direct: async fn', async (t, resolve) => {
  t.deepEqual(
    await drain(
      gen(
        delay(x => x * x),
        x => 2 * x + 1
      ),
      2
    ),
    [9]
  );
  resolve();
});

test.asPromise('gen direct: flush emits buffered remainder', async (t, resolve) => {
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
  const g = gen(batchBy(3));
  t.deepEqual(await drain(g, 1), [], 'buffered');
  t.deepEqual(await drain(g, 2), [], 'buffered');
  t.deepEqual(await drain(g, none), [1, 2], 'flush emits remainder');
  resolve();
});

test.asPromise('gen direct: stop halts', async (t, resolve) => {
  const g = gen(x => (x === 2 ? stop : x));
  t.deepEqual(await drain(g, 1), [1]);
  let threw = false;
  try {
    await drain(g, 2);
  } catch (e) {
    threw = e instanceof Stop;
  }
  t.ok(threw, 'threw Stop');
  resolve();
});
