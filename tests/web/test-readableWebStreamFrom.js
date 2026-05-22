'use strict';

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import {none, stop, many} from '../../src/defs.js';
import readableWebStreamFrom from '../../src/utils/readableWebStreamFrom.js';

const drain = async stream => {
  const out = [];
  for await (const v of stream) out.push(v);
  return out;
};

test.asPromise('readableWebStreamFrom: smoke test (array)', async (t, resolve) => {
  const out = await drain(readableWebStreamFrom([1, 2, 3]));
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('readableWebStreamFrom: function', async (t, resolve) => {
  const out = await drain(readableWebStreamFrom(() => 0));
  t.deepEqual(out, [0]);
  resolve();
});

test.asPromise('readableWebStreamFrom: async function', async (t, resolve) => {
  const out = await drain(readableWebStreamFrom(delay(() => 0)));
  t.deepEqual(out, [0]);
  resolve();
});

test.asPromise('readableWebStreamFrom: generator', async (t, resolve) => {
  const out = await drain(
    readableWebStreamFrom(function* () {
      yield 0;
      yield 1;
    })
  );
  t.deepEqual(out, [0, 1]);
  resolve();
});

test.asPromise('readableWebStreamFrom: async generator', async (t, resolve) => {
  const out = await drain(
    readableWebStreamFrom(async function* () {
      yield delay(() => 0)();
      yield delay(() => 1)();
    })
  );
  t.deepEqual(out, [0, 1]);
  resolve();
});

test.asPromise('readableWebStreamFrom: nextable (iterator instance)', async (t, resolve) => {
  const out = await drain(
    readableWebStreamFrom(
      (function* () {
        yield 0;
        yield 1;
      })()
    )
  );
  t.deepEqual(out, [0, 1]);
  resolve();
});

test.asPromise('readableWebStreamFrom: options object with iterable', async (t, resolve) => {
  const out = await drain(readableWebStreamFrom({iterable: [10, 20, 30]}));
  t.deepEqual(out, [10, 20, 30]);
  resolve();
});

test.asPromise('readableWebStreamFrom: skips none / null / undefined', async (t, resolve) => {
  const out = await drain(
    readableWebStreamFrom(function* () {
      yield 1;
      yield none;
      yield null;
      yield undefined;
      yield 2;
    })
  );
  t.deepEqual(out, [1, 2]);
  resolve();
});

test.asPromise('readableWebStreamFrom: stop sentinel terminates cleanly', async (t, resolve) => {
  // Generators yield plain values by convention — `stop` must be returned by a
  // function source. Express terminate-on-condition in a generator with `return`.
  const out = await drain(readableWebStreamFrom(() => stop));
  t.deepEqual(out, []);
  resolve();
});

test.asPromise('readableWebStreamFrom: many expansion from function source', async (t, resolve) => {
  const out = await drain(readableWebStreamFrom(() => many([1, 2, 3])));
  t.deepEqual(out, [1, 2, 3]);
  resolve();
});

test.asPromise('readableWebStreamFrom: backpressure (hwm=1, slow consumer)', async (t, resolve) => {
  const stream = readableWebStreamFrom({
    iterable: [1, 2, 3, 4, 5],
    strategy: {highWaterMark: 1}
  });
  const reader = stream.getReader();
  const out = [];
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    out.push(value);
    await delay(() => null, 5)();
  }
  t.deepEqual(out, [1, 2, 3, 4, 5]);
  resolve();
});

test.asPromise('readableWebStreamFrom: cancel stops the pump', async (t, resolve) => {
  let produced = 0;
  const stream = readableWebStreamFrom(function* () {
    while (true) {
      ++produced;
      yield produced;
    }
  });
  const reader = stream.getReader();
  const {value: v1} = await reader.read();
  t.equal(v1, 1);
  await reader.cancel();
  // After cancel the pump should bail; produced should not run away.
  const before = produced;
  await delay(() => null, 20)();
  t.ok(produced - before <= 1, 'pump halts shortly after cancel');
  resolve();
});

test.asPromise('readableWebStreamFrom: throws on bad input', (t, resolve) => {
  t.throws(() => readableWebStreamFrom(null), TypeError);
  t.throws(() => readableWebStreamFrom({}), TypeError);
  t.throws(() => readableWebStreamFrom(42), TypeError);
  resolve();
});

test.asPromise(
  'readableWebStreamFrom: function returning a generator is iterated',
  async (t, resolve) => {
    const out = await drain(
      readableWebStreamFrom(() =>
        (function* () {
          yield 1;
          yield 2;
        })()
      )
    );
    t.deepEqual(out, [1, 2]);
    resolve();
  }
);
