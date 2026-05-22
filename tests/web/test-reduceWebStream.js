'use strict';

import test from 'tape-six';

import {delay} from '../web-helpers.js';
import reduceWebStream from '../../src/utils/reduceWebStream.js';

const feed = async (writable, values) => {
  const writer = writable.getWriter();
  for (const v of values) await writer.write(v);
  await writer.close();
};

test.asPromise('reduceWebStream: sum (positional reducer + initial)', async (t, resolve) => {
  const {writable, result} = reduceWebStream((acc, x) => acc + x, 0);
  await feed(writable, [1, 2, 3]);
  t.equal(await result, 6);
  resolve();
});

test.asPromise('reduceWebStream: async reducer', async (t, resolve) => {
  const {writable, result} = reduceWebStream({
    reducer: delay((acc, x) => acc + x),
    initial: 0
  });
  await feed(writable, [1, 2, 3]);
  t.equal(await result, 6);
  resolve();
});

test.asPromise('reduceWebStream: defaults — last value wins', async (t, resolve) => {
  const {writable, result} = reduceWebStream();
  await feed(writable, ['a', 'b', 'c']);
  t.equal(await result, 'c');
  resolve();
});

test.asPromise('reduceWebStream: no input → initial accumulator', async (t, resolve) => {
  const {writable, result} = reduceWebStream((acc, x) => acc + x, 42);
  await feed(writable, []);
  t.equal(await result, 42);
  resolve();
});

test.asPromise(
  'reduceWebStream: reducer sees this.accumulator (Node parity)',
  async (t, resolve) => {
    const seen = [];
    const r = reduceWebStream(function (acc, x) {
      seen.push({thisAcc: this.accumulator, argAcc: acc});
      return acc + x;
    }, 100);
    await feed(r.writable, [1, 2, 3]);
    t.equal(await r.result, 106);
    t.deepEqual(seen, [
      {thisAcc: 100, argAcc: 100},
      {thisAcc: 101, argAcc: 101},
      {thisAcc: 103, argAcc: 103}
    ]);
    resolve();
  }
);

test.asPromise('reduceWebStream: .accumulator is a live getter', async (t, resolve) => {
  const r = reduceWebStream((acc, x) => acc + x, 0);
  t.equal(r.accumulator, 0, 'initial accumulator visible before any writes');

  const writer = r.writable.getWriter();
  await writer.write(5);
  t.equal(r.accumulator, 5, 'updates after each write');
  await writer.write(7);
  t.equal(r.accumulator, 12);
  await writer.close();
  t.equal(await r.result, 12, 'result resolves to the same final value');
  resolve();
});

test.asPromise('reduceWebStream: object accumulator', async (t, resolve) => {
  const {writable, result} = reduceWebStream((acc, x) => ({...acc, [x.k]: x.v}), {});
  await feed(writable, [
    {k: 'a', v: 1},
    {k: 'b', v: 2}
  ]);
  t.deepEqual(await result, {a: 1, b: 2});
  resolve();
});

// Lifecycle / error propagation.

test.asPromise('reduceWebStream: reducer throws → result rejects', async (t, resolve) => {
  const {writable, result} = reduceWebStream((acc, x) => {
    if (x === 2) throw new Error('boom');
    return acc + x;
  }, 0);
  const writer = writable.getWriter();
  await writer.write(1);
  try {
    await writer.write(2);
    t.fail('write should reject');
  } catch (e) {
    t.equal(e?.message, 'boom');
  }
  try {
    await result;
    t.fail('result should reject');
  } catch (e) {
    t.equal(e?.message, 'boom');
  }
  resolve();
});

test.asPromise('reduceWebStream: async reducer rejection propagates', async (t, resolve) => {
  const {writable, result} = reduceWebStream(async (_acc, _x) => {
    await delay(() => null, 5)();
    throw new Error('async-boom');
  }, 0);
  const writer = writable.getWriter();
  try {
    await writer.write(1);
    t.fail('write should reject');
  } catch (e) {
    t.equal(e?.message, 'async-boom');
  }
  try {
    await result;
    t.fail('result should reject');
  } catch (e) {
    t.equal(e?.message, 'async-boom');
  }
  resolve();
});

test.asPromise(
  'reduceWebStream: writer.abort() → result rejects with reason',
  async (t, resolve) => {
    const {writable, result} = reduceWebStream((acc, x) => acc + x, 0);
    const writer = writable.getWriter();
    await writer.write(1);
    await writer.abort(new Error('cancelled'));
    try {
      await result;
      t.fail('result should reject');
    } catch (e) {
      t.equal(e?.message, 'cancelled');
    }
    resolve();
  }
);
