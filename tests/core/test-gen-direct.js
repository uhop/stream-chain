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

test.asPromise(
  'gen direct: a generator source is returned (its finally runs) when the consumer cancels',
  async (t, resolve) => {
    let cleaned = false;
    const source = async function* () {
      try {
        for (let n = 0; ; ++n) yield n; // infinite — only stops when returned
      } finally {
        cleaned = true;
      }
    };
    const g = gen(source);
    for await (const v of g(0)) {
      void v;
      break; // consume one item, then cancel — must propagate to the source's .return()
    }
    await delay(() => null, 10)(); // let the producer's CANCEL unwind reach the source's it.return()
    t.ok(cleaned, 'the source generator was returned so its finally ran on consumer cancel');
    resolve();
  }
);

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

// Edges a push→pull bridge must handle that native gen gets for free — the
// promotion gate for swapping gen()'s engine.

test.asPromise(
  'gen direct: early break yields the prefix (cleanup, no hang)',
  async (t, resolve) => {
    const g = gen(x => many([x, x + 1, x + 2, x + 3, x + 4]));
    const out = [];
    for await (const v of g(10)) {
      out.push(v);
      if (out.length >= 2) break;
    }
    t.deepEqual(out, [10, 11], 'got the prefix and broke cleanly');
    resolve();
  }
);

test.asPromise('gen direct: mid-stream error propagates', async (t, resolve) => {
  const g = gen(
    () => many([1, 2, 3]),
    v => {
      if (v === 2) throw new Error('boom');
      return v;
    }
  );
  const out = [];
  let msg = null;
  try {
    for await (const v of g(0)) out.push(v);
  } catch (e) {
    msg = e.message;
  }
  t.deepEqual(out, [1], 'yielded values before the throw');
  t.equal(msg, 'boom', 'error propagated to the consumer');
  resolve();
});

test.asPromise('gen direct: consumer .throw() propagates and cleans up', async (t, resolve) => {
  const g = gen(x => many([x, x + 1, x + 2, x + 3]));
  const it = g(10);
  const first = await it.next();
  t.equal(first.value, 10, 'got the first value');
  let caught = null;
  try {
    await it.throw(new Error('injected'));
  } catch (e) {
    caught = e.message;
  }
  t.equal(caught, 'injected', '.throw() rejected with the injected error');
  // the iterator is done; a further next() yields nothing
  const after = await it.next();
  t.ok(after.done, 'iterator finished after .throw()');
  resolve();
});
