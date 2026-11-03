'use strict';

import test from 'tape-six';
import {once} from 'node:events';
import readableFrom from '../../src/utils/readableFrom.js';
import {finalValue, many, stop} from '../../src/defs.js';

const closed = stream => new Promise(resolve => stream.once('close', resolve));

for (const asynchronous of [false, true]) {
  const source = state => {
    const inner = function* () {
      try {
        for (let i = 0; i < 100; ++i) {
          ++state.produced;
          yield i;
        }
      } finally {
        ++state.inner;
      }
    };
    const outer = function* () {
      try {
        yield* inner();
      } finally {
        ++state.outer;
      }
    };
    return asynchronous
      ? async function* () {
          yield* outer();
        }
      : outer;
  };

  test.asPromise(
    `readableFrom: break releases nested sources (async ${asynchronous})`,
    async (t, resolve) => {
      const state = {produced: 0, inner: 0, outer: 0};
      const stream = readableFrom({iterable: source(state), highWaterMark: 1});
      const done = closed(stream);
      for await (const value of stream) {
        t.equal(value, 0);
        break;
      }
      await done;
      t.equal(state.inner, 1);
      t.equal(state.outer, 1);
      t.ok(state.produced <= 2);
      resolve();
    }
  );

  test.asPromise(
    `readableFrom: destroy releases a paused source (async ${asynchronous})`,
    async (t, resolve) => {
      const state = {produced: 0, inner: 0, outer: 0};
      const stream = readableFrom({iterable: source(state), highWaterMark: 1});
      await once(stream, 'readable');
      const done = closed(stream);
      stream.destroy();
      await done;
      t.equal(state.inner, 1);
      t.equal(state.outer, 1);
      t.equal(state.produced, 1);
      stream.destroy();
      t.equal(state.outer, 1, 'repeated destruction does not repeat cleanup');
      resolve();
    }
  );
}

test.asPromise('readableFrom: a rejected yielded value releases its source', async (t, resolve) => {
  const error = new Error('source failed');
  let released = 0;
  const stream = readableFrom(function* () {
    try {
      yield Promise.reject(error);
    } finally {
      ++released;
    }
  });
  const errors = [];
  stream.on('error', error => errors.push(error));
  await closed(stream);
  t.deepEqual(errors, [error]);
  t.equal(released, 1);
  resolve();
});

test.asPromise('readableFrom: stop releases the source without an error', async (t, resolve) => {
  let released = 0;
  const stream = readableFrom(function* () {
    try {
      yield 1;
      yield stop;
      yield 2;
    } finally {
      ++released;
    }
  });
  const values = [];
  for await (const value of stream) values.push(value);
  t.deepEqual(values, [1]);
  t.equal(released, 1);
  resolve();
});

test.asPromise(
  'readableFrom: destroy awaits a pending next and returns it once',
  async (t, resolve) => {
    let finishNext, started;
    const pending = new Promise(resolve => (started = resolve));
    let returns = 0;
    const stream = readableFrom(() => ({
      next() {
        started();
        return new Promise(resolve => (finishNext = resolve));
      },
      async return() {
        await Promise.resolve();
        ++returns;
        return {done: true};
      }
    }));
    await pending;
    let isClosed = false;
    const done = closed(stream).then(() => (isClosed = true));
    stream.destroy();
    await new Promise(resolve => setTimeout(resolve, 5));
    t.equal(isClosed, false);
    finishNext({value: 'late', done: false});
    await done;
    t.equal(returns, 1);
    t.equal(stream.readableLength, 0);
    resolve();
  }
);

test.asPromise(
  'readableFrom: cleanup failure preserves the destroy error and custom hook',
  async (t, resolve) => {
    const original = new Error('consumer failed');
    const cleanup = new Error('cleanup failed');
    let hookThis,
      hookError,
      returns = 0;
    const stream = readableFrom({
      iterable: () => ({
        next: () => ({value: 1, done: false}),
        return() {
          ++returns;
          throw cleanup;
        }
      }),
      highWaterMark: 1,
      destroy(error, callback) {
        hookThis = this;
        hookError = error;
        callback(error);
      }
    });
    const errors = [];
    stream.on('error', error => errors.push(error));
    await once(stream, 'readable');
    const done = closed(stream);
    stream.destroy(original);
    await done;
    t.equal(returns, 1);
    t.equal(hookThis, stream);
    t.ok(hookError instanceof AggregateError);
    t.deepEqual(hookError.errors, [original, cleanup]);
    t.deepEqual(errors, [hookError]);
    resolve();
  }
);

test.asPromise('readableFrom: normal exhaustion does not call return', async (t, resolve) => {
  let index = 0,
    returns = 0;
  const stream = readableFrom(() => ({
    next: () => ({value: index++, done: index > 3}),
    return() {
      ++returns;
      return {done: true};
    }
  }));
  const values = [];
  for await (const value of stream) values.push(value);
  t.deepEqual(values, [0, 1, 2]);
  t.equal(returns, 0);
  resolve();
});

test.asPromise(
  'readableFrom: abort during source creation still awaits cleanup',
  async (t, resolve) => {
    const controller = new AbortController();
    let returns = 0;
    const stream = readableFrom({
      signal: controller.signal,
      iterable: () => {
        controller.abort();
        return {
          next: () => ({value: 'late', done: false}),
          async return() {
            await Promise.resolve();
            ++returns;
            return {done: true};
          }
        };
      }
    });
    const errors = [];
    stream.on('error', error => errors.push(error));
    await closed(stream);
    t.equal(returns, 1);
    t.equal(errors.length, 1);
    t.equal(errors[0].code, 'ABORT_ERR');
    resolve();
  }
);

test.asPromise(
  'readableFrom: a throwing custom destroy hook remains an error event',
  async (t, resolve) => {
    const error = new Error('hook failed');
    let released = 0;
    const stream = readableFrom({
      iterable: function* () {
        try {
          yield 1;
          yield 2;
        } finally {
          ++released;
        }
      },
      highWaterMark: 1,
      destroy() {
        throw error;
      }
    });
    const errors = [];
    stream.on('error', error => errors.push(error));
    await once(stream, 'readable');
    const done = closed(stream);
    stream.destroy();
    await done;
    t.equal(released, 1);
    t.deepEqual(errors, [error]);
    resolve();
  }
);

test.asPromise('readableFrom: nested many sources release inside out', async (t, resolve) => {
  const order = [];
  const inner = function* () {
    try {
      yield 1;
      yield 2;
    } finally {
      order.push('inner');
      throw new Error('inner cleanup');
    }
  };
  const outer = async function* () {
    try {
      yield many(inner());
    } finally {
      await Promise.resolve();
      order.push('outer');
    }
  };
  const stream = readableFrom({iterable: outer, highWaterMark: 1});
  const errors = [];
  stream.on('error', error => errors.push(error));
  await once(stream, 'readable');
  const done = closed(stream);
  stream.destroy();
  await done;
  t.deepEqual(order, ['inner', 'outer']);
  t.equal(errors.length, 1);
  t.equal(errors[0].message, 'inner cleanup');
  resolve();
});

for (const wrap of [many, finalValue, value => finalValue(many(value))]) {
  test.asPromise(
    'readableFrom: a wrapped source arriving after cancel is returned',
    async (t, resolve) => {
      let finishSource,
        returns = 0;
      const source = () => new Promise(resolve => (finishSource = resolve));
      const stream = readableFrom(source);
      const done = closed(stream);
      stream.destroy();
      finishSource(
        wrap({
          next: () => ({value: 'late', done: false}),
          return() {
            ++returns;
            return {done: true};
          }
        })
      );
      await done;
      t.equal(returns, 1);
      resolve();
    }
  );
}
