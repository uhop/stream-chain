'use strict';

import test from 'tape-six';
import readableWebStreamFrom from '../../src/utils/readableWebStreamFrom.js';
import {finalValue, many, stop} from '../../src/defs.js';

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
    `readableWebStreamFrom: break releases nested sources (async ${asynchronous})`,
    async (t, resolve) => {
      const state = {produced: 0, inner: 0, outer: 0};
      const stream = readableWebStreamFrom(source(state));
      for await (const value of stream) {
        t.equal(value, 0);
        break;
      }
      t.equal(state.inner, 1);
      t.equal(state.outer, 1);
      t.ok(state.produced <= 2);
      resolve();
    }
  );

  test.asPromise(
    `readableWebStreamFrom: cancel releases a paused source (async ${asynchronous})`,
    async (t, resolve) => {
      const state = {produced: 0, inner: 0, outer: 0};
      const stream = readableWebStreamFrom(source(state));
      const reader = stream.getReader();
      await reader.read();
      await reader.cancel();
      t.equal(state.inner, 1);
      t.equal(state.outer, 1);
      t.ok(state.produced <= 2);
      await reader.cancel();
      t.equal(state.outer, 1);
      resolve();
    }
  );
}

test.asPromise(
  'readableWebStreamFrom: rejected yielded values release their source',
  async (t, resolve) => {
    const error = new Error('source failed');
    let released = 0;
    const stream = readableWebStreamFrom(function* () {
      try {
        yield Promise.reject(error);
      } finally {
        ++released;
      }
    });
    try {
      await stream.getReader().read();
      t.fail('read must reject');
    } catch (observed) {
      t.equal(observed, error);
    }
    t.equal(released, 1);
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: a failing sink cancels and releases the source',
  async (t, resolve) => {
    const error = new Error('sink failed');
    let released = 0;
    const stream = readableWebStreamFrom(function* () {
      try {
        for (let i = 0; i < 100; ++i) yield i;
      } finally {
        ++released;
      }
    });
    try {
      await stream.pipeTo(
        new WritableStream({
          write() {
            throw error;
          }
        })
      );
      t.fail('pipe must reject');
    } catch (observed) {
      t.equal(observed, error);
    }
    t.equal(released, 1);
    resolve();
  }
);

test.asPromise('readableWebStreamFrom: stop releases its source cleanly', async (t, resolve) => {
  let released = 0;
  const stream = readableWebStreamFrom(function* () {
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
  'readableWebStreamFrom: cancellation returns a pending iterator without waiting for next',
  async (t, resolve) => {
    let finishNext, started;
    const pending = new Promise(resolve => (started = resolve));
    let returns = 0;
    const stream = readableWebStreamFrom(() => ({
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
    const reader = stream.getReader();
    const read = reader.read();
    await pending;
    let cancelled = false;
    const done = reader.cancel().then(() => (cancelled = true));
    await Promise.resolve();
    t.ok(await settlesBeforeSource(done));
    t.equal(cancelled, true);
    t.equal(returns, 1);
    finishNext({value: 'late', done: false});
    await done;
    t.equal(returns, 1);
    t.equal((await read).done, true);
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: a source arriving after cancel is returned',
  async (t, resolve) => {
    let finishSource,
      finishReturn,
      returns = 0;
    const returned = new Promise(resolve => (finishReturn = resolve));
    const stream = readableWebStreamFrom(() => new Promise(resolve => (finishSource = resolve)));
    const reader = stream.getReader();
    let cancelled = false;
    const done = reader.cancel().then(() => (cancelled = true));
    await Promise.resolve();
    t.ok(await settlesBeforeSource(done));
    t.equal(cancelled, true);
    finishSource({
      next: () => ({value: 'late', done: false}),
      return() {
        ++returns;
        finishReturn();
        return {done: true};
      }
    });
    await returned;
    await done;
    t.equal(returns, 1);
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: cancellation reports cleanup failures',
  async (t, resolve) => {
    const error = new Error('cleanup failed');
    const stream = readableWebStreamFrom(() => ({
      next: () => ({value: 1, done: false}),
      return() {
        throw error;
      }
    }));
    const reader = stream.getReader();
    await reader.read();
    try {
      await reader.cancel();
      t.fail('cancel must report cleanup failure');
    } catch (observed) {
      t.equal(observed, error);
    }
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: source and cleanup errors are retained',
  async (t, resolve) => {
    const original = new Error('source failed');
    const cleanup = new Error('cleanup failed');
    const stream = readableWebStreamFrom(() => ({
      next: () => Promise.reject(original),
      return() {
        throw cleanup;
      }
    }));
    try {
      await stream.getReader().read();
      t.fail('read must reject');
    } catch (observed) {
      t.ok(observed instanceof AggregateError);
      t.deepEqual(observed.errors, [original, cleanup]);
    }
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: normal exhaustion does not call return',
  async (t, resolve) => {
    let index = 0,
      returns = 0;
    const stream = readableWebStreamFrom(() => ({
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
  }
);

test.asPromise(
  'readableWebStreamFrom: nested many sources release inside out',
  async (t, resolve) => {
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
    const reader = readableWebStreamFrom(outer).getReader();
    await reader.read();
    try {
      await reader.cancel();
      t.fail('cancel must report cleanup failure');
    } catch (error) {
      t.equal(error.message, 'inner cleanup');
    }
    t.deepEqual(order, ['inner', 'outer']);
    resolve();
  }
);

for (const wrap of [many, finalValue, value => finalValue(many(value))]) {
  test.asPromise(
    'readableWebStreamFrom: a wrapped source arriving after cancel is returned',
    async (t, resolve) => {
      let finishSource,
        finishReturn,
        returns = 0;
      const returned = new Promise(resolve => (finishReturn = resolve));
      const source = () => new Promise(resolve => (finishSource = resolve));
      const reader = readableWebStreamFrom(source).getReader();
      const done = reader.cancel();
      t.ok(await settlesBeforeSource(done));
      finishSource(
        wrap({
          next: () => ({value: 'late', done: false}),
          return() {
            ++returns;
            finishReturn();
            return {done: true};
          }
        })
      );
      await returned;
      await done;
      t.equal(returns, 1);
      resolve();
    }
  );
}

test.asPromise(
  'readableWebStreamFrom: an undefined thrown error stays an error',
  async (t, resolve) => {
    const stream = readableWebStreamFrom(() => {
      throw undefined;
    });
    try {
      await stream.getReader().read();
      t.fail('read must reject');
    } catch (error) {
      t.equal(error, undefined);
    }
    resolve();
  }
);

for (const stopping of [false, true]) {
  test.asPromise(
    `readableWebStreamFrom: undefined cleanup errors reject (stop ${stopping})`,
    async (t, resolve) => {
      let returns = 0;
      const reader = readableWebStreamFrom(() => ({
        next: () => ({value: stopping ? stop : 1, done: false}),
        return() {
          ++returns;
          throw undefined;
        }
      })).getReader();
      try {
        if (stopping) {
          await reader.read();
        } else {
          await reader.read();
          await reader.cancel();
        }
        t.fail('cleanup must reject');
      } catch (error) {
        t.equal(error, undefined);
      }
      t.equal(returns, 1);
      resolve();
    }
  );
}

const settlesBeforeSource = async promise => {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise(resolve => (timer = setTimeout(() => resolve(false), 100)))
    ]);
  } finally {
    clearTimeout(timer);
  }
};

test.asPromise(
  'readableWebStreamFrom: break after an await does not wait for the source',
  async (t, resolve) => {
    let finishSource, startNext, finishReturn;
    const source = new Promise(resolve => (finishSource = resolve));
    const started = new Promise(resolve => (startNext = resolve));
    const returned = new Promise(resolve => (finishReturn = resolve));
    const stream = readableWebStreamFrom(async function* () {
      try {
        yield 1;
        startNext();
        await source;
        yield 2;
      } finally {
        finishReturn();
      }
    });
    const values = [];
    const loop = (async () => {
      for await (const value of stream) {
        values.push(value);
        await started;
        break;
      }
    })();
    t.ok(await settlesBeforeSource(loop));
    finishSource();
    await loop;
    await returned;
    t.deepEqual(values, [1]);
    resolve();
  }
);

test.asPromise(
  'readableWebStreamFrom: pipeTo abort does not wait for the source',
  async (t, resolve) => {
    const failure = new Error('consumer aborted');
    const controller = new AbortController();
    let finishSource, startNext, finishReturn;
    const source = new Promise(resolve => (finishSource = resolve));
    const started = new Promise(resolve => (startNext = resolve));
    const returned = new Promise(resolve => (finishReturn = resolve));
    const stream = readableWebStreamFrom(async function* () {
      try {
        yield 1;
        startNext();
        await source;
      } finally {
        finishReturn();
      }
    });
    const outcome = stream.pipeTo(new WritableStream(), {signal: controller.signal}).then(
      () => null,
      error => error
    );
    await started;
    controller.abort(failure);
    t.ok(await settlesBeforeSource(outcome));
    finishSource();
    t.equal(await outcome, failure);
    await returned;
    resolve();
  }
);

for (const wrap of [many, value => finalValue(many(value))]) {
  test.asPromise(
    'readableWebStreamFrom: a wrapped value from a cancelled next is released',
    async (t, resolve) => {
      let finishNext, startNext, finishChild;
      const started = new Promise(resolve => (startNext = resolve));
      const childReturned = new Promise(resolve => (finishChild = resolve));
      let returns = 0;
      const child = {
        next: () => ({value: 'unused', done: false}),
        return() {
          ++returns;
          finishChild();
          return {done: true};
        }
      };
      const stream = readableWebStreamFrom(() => ({
        next() {
          startNext();
          return new Promise(resolve => (finishNext = resolve));
        },
        return: () => ({done: true})
      }));
      const reader = stream.getReader();
      reader.read().catch(() => {});
      await started;
      const done = reader.cancel();
      t.ok(await settlesBeforeSource(done));
      finishNext({value: wrap(child), done: false});
      t.ok(await settlesBeforeSource(childReturned));
      t.equal(returns, 1);
      await done;
      resolve();
    }
  );
}

test.asPromise(
  'readableWebStreamFrom: cancelling inside a synchronous generator still releases it',
  async (t, resolve) => {
    let reader, cancellation, finishReturn;
    const returned = new Promise(resolve => (finishReturn = resolve));
    let releases = 0;
    const stream = readableWebStreamFrom(function* () {
      try {
        cancellation = reader.cancel();
        yield 1;
      } finally {
        ++releases;
        finishReturn();
      }
    });
    reader = stream.getReader();
    const read = reader.read();
    t.ok(await settlesBeforeSource(returned));
    await cancellation;
    t.equal(releases, 1);
    t.equal((await read).done, true);
    resolve();
  }
);
