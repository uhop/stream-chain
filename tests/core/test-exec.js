'use strict';

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import {none, finalValue, many, stop, flushable, Stop} from '../../src/defs.js';

import exec from '../../src/exec.js';

const isThenable = v => v && typeof v.then == 'function';

// Drive `exec(...fns)` over inputs with a non-backpressuring sink (push returns
// undefined), then flush. Mirrors how a stream would feed it. Returns output.
const run = async (fns, inputs) => {
  const out = [];
  const driver = exec(...fns);
  const push = v => void out.push(v);
  for (const v of inputs) {
    const r = driver(v, push);
    if (isThenable(r)) await r;
  }
  const fr = driver(none, push); // flush
  if (isThenable(fr)) await fr;
  return out;
};

// ── output equivalence with fun() (same fn-lists, same expected values) ──

test.asPromise('exec: smoke', async (t, resolve) => {
  t.deepEqual(await run([x => x * x, x => 2 * x + 1], [1, 2, 3]), [3, 9, 19]);
  resolve();
});

test.asPromise('exec: final short-circuits', async (t, resolve) => {
  t.deepEqual(await run([x => x * x, x => finalValue(x), x => 2 * x + 1], [1, 2, 3]), [1, 4, 9]);
  resolve();
});

test.asPromise('exec: none drops', async (t, resolve) => {
  t.deepEqual(await run([x => x * x, () => none, x => 2 * x + 1], [1, 2, 3]), []);
  resolve();
});

test.asPromise('exec: empty list is identity', async (t, resolve) => {
  t.deepEqual(await run([], [1, 2, 3]), [1, 2, 3]);
  resolve();
});

test.asPromise('exec: generator', async (t, resolve) => {
  const out = await run(
    [
      x => x * x,
      function* (x) {
        yield x;
        yield x + 1;
        yield x + 2;
      },
      x => 2 * x + 1
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
  resolve();
});

test.asPromise(
  'exec: a generator source is returned (its finally runs) when a downstream stage throws',
  async (t, resolve) => {
    let cleaned = false;
    const source = async function* () {
      try {
        yield 1;
        yield 2;
        yield 3;
      } finally {
        cleaned = true;
      }
    };
    const boom = new Error('boom');
    const thrower = x => {
      if (x === 2) throw boom;
      return x;
    };
    let caught;
    try {
      await run([source, thrower], [0]);
    } catch (e) {
      caught = e;
    }
    t.equal(caught, boom, 'the original downstream error propagates');
    t.ok(cleaned, 'the source generator was returned so its finally ran (no leaked resource)');
    resolve();
  }
);

test.asPromise('exec: many', async (t, resolve) => {
  const out = await run([x => x * x, x => many([x, x + 1, x + 2]), x => 2 * x + 1], [1, 2, 3]);
  t.deepEqual(out, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
  resolve();
});

test.asPromise('exec: async fn', async (t, resolve) => {
  t.deepEqual(await run([delay(x => x * x), x => 2 * x + 1], [1, 2, 3]), [3, 9, 19]);
  resolve();
});

test.asPromise('exec: async generator', async (t, resolve) => {
  const out = await run(
    [
      async function* (x) {
        yield x;
        yield x * 10;
      }
    ],
    [1, 2, 3]
  );
  t.deepEqual(out, [1, 10, 2, 20, 3, 30]);
  resolve();
});

test.asPromise('exec: combined async/many/gen', async (t, resolve) => {
  const out = await run(
    [
      delay(x => -x),
      x => many([x, x * 10]),
      function* (x) {
        yield x;
        yield x - 1;
      },
      x => -x
    ],
    [1, 2]
  );
  t.deepEqual(out, [1, 2, 10, 11, 2, 3, 20, 21]);
  resolve();
});

// ── flush ──

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

test.asPromise('exec: flush emits buffered remainder', async (t, resolve) => {
  t.deepEqual(
    await run([batchBy(3)], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
  resolve();
});

// ── stop ──

test.asPromise('exec: stop halts the pipeline', async (t, resolve) => {
  const out = [];
  let c = 0;
  const stopAfter = x => (c++ < 4 ? x : stop);
  const driver = exec(stopAfter);
  const push = v => void out.push(v);
  let threw = false;
  try {
    for (const v of [0, 1, 2, 3, 4, 5, 6]) {
      const r = driver(v, push);
      if (isThenable(r)) await r;
    }
  } catch (e) {
    threw = e instanceof Stop;
  }
  t.deepEqual(out, [0, 1, 2, 3]);
  t.ok(threw, 'threw Stop');
  resolve();
});

// ── bounded queue: the three swelling vectors ──
//
// A backpressuring push returns a pending Promise on its FIRST call. A correct
// executor must suspend AT that push — so synchronously, exactly one item is
// pushed, not all K. A swelling executor would push all K before yielding.

const suspendsAtFirstPush = async (t, label, fns, K) => {
  const driver = exec(...fns);
  let pushed = 0;
  let release;
  const push = () => {
    if (++pushed === 1) return new Promise(r => (release = r));
  };
  const done = driver(0, push);
  t.equal(pushed, 1, `${label}: suspended after first push (not ${K})`);
  t.ok(isThenable(done), `${label}: driver returned a promise (suspended)`);
  release(); // let it drain the rest (no further backpressure)
  await done;
  t.equal(pushed, K, `${label}: all ${K} eventually pushed`);
};

test.asPromise('exec: bounded — many at end', async (t, resolve) => {
  const K = 100;
  await suspendsAtFirstPush(
    t,
    'many-at-end',
    [x => many(Array.from({length: K}, (_, i) => x + i))],
    K
  );
  resolve();
});

test.asPromise('exec: bounded — many mid-chain', async (t, resolve) => {
  const K = 100;
  await suspendsAtFirstPush(
    t,
    'many-mid-chain',
    [x => many(Array.from({length: K}, (_, i) => x + i)), y => y + 1],
    K
  );
  resolve();
});

test.asPromise('exec: bounded — generator yields', async (t, resolve) => {
  const K = 100;
  await suspendsAtFirstPush(
    t,
    'generator-yields',
    [
      function* (x) {
        for (let i = 0; i < K; ++i) yield x + i;
      }
    ],
    K
  );
  resolve();
});

test.asPromise('exec: fully synchronous when push never backpressures', async (t, resolve) => {
  const K = 100;
  const driver = exec(x => many(Array.from({length: K}, (_, i) => x + i)));
  let pushed = 0;
  const push = () => void ++pushed; // never returns a promise
  const r = driver(0, push);
  t.equal(r, undefined, 'returned undefined — ran fully synchronously');
  t.equal(pushed, K, 'pushed all K synchronously');
  resolve();
});
