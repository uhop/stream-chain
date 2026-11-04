'use strict';

import test from 'tape-six';
import {once, on, EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import readableWebStreamFrom from '../../src/utils/readableWebStreamFrom.js';
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
  'readableFrom: destroy returns a pending iterator without waiting for next',
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
    t.ok(await settlesBeforeSource(done));
    t.equal(isClosed, true);
    t.equal(returns, 1);
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
        finishReturn,
        returns = 0;
      const returned = new Promise(resolve => (finishReturn = resolve));
      const source = () => new Promise(resolve => (finishSource = resolve));
      const stream = readableFrom(source);
      const done = closed(stream);
      stream.destroy();
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

for (const web of [false, true]) {
  test.asPromise(
    `readable sources: idle events.on iterator can be cancelled (Web ${web})`,
    async (t, resolve) => {
      const emitter = new EventEmitter();
      const iterator = on(emitter, 'item');
      let startNext;
      const started = new Promise(resolve => (startNext = resolve));
      const next = iterator.next.bind(iterator);
      iterator.next = () => {
        startNext();
        return next();
      };
      const stream = web ? readableWebStreamFrom(() => iterator) : readableFrom(() => iterator);
      const reader = web ? stream.getReader() : null;
      if (web) reader.read().catch(() => {});
      else stream.resume();
      await started;
      const done = web ? reader.cancel() : closed(stream);
      if (!web) stream.destroy();
      const settled = await settlesBeforeSource(done);
      t.ok(settled, 'teardown does not need a source event');
      t.equal(emitter.listenerCount('item'), 0, 'return removes the source listener');
      if (!settled) emitter.emit('item', 1);
      await done;
      resolve();
    }
  );
}

test.asPromise(
  'readableFrom: a stalled async source does not block destroy',
  async (t, resolve) => {
    let finishSource, startNext, finishReturn;
    const source = new Promise(resolve => (finishSource = resolve));
    const started = new Promise(resolve => (startNext = resolve));
    const returned = new Promise(resolve => (finishReturn = resolve));
    const stream = readableFrom(async function* () {
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
    stream.on('data', value => values.push(value));
    await started;
    const done = closed(stream);
    stream.destroy();
    t.ok(await settlesBeforeSource(done));
    finishSource();
    await done;
    await returned;
    t.deepEqual(values, [1]);
    resolve();
  }
);

test.asPromise(
  'readableFrom: a failed sink finishes while its source is stalled',
  async (t, resolve) => {
    const failure = new Error('sink failed');
    let finishSource, startNext, finishReturn;
    const source = new Promise(resolve => (finishSource = resolve));
    const started = new Promise(resolve => (startNext = resolve));
    const returned = new Promise(resolve => (finishReturn = resolve));
    const stream = readableFrom(async function* () {
      try {
        yield 1;
        startNext();
        await source;
      } finally {
        finishReturn();
      }
    });
    const outcome = pipeline(
      stream,
      new Writable({
        objectMode: true,
        write(value, encoding, callback) {
          started.then(() => callback(failure));
        }
      })
    ).then(
      () => null,
      error => error
    );
    await started;
    t.ok(await settlesBeforeSource(outcome));
    finishSource();
    t.equal(await outcome, failure);
    await returned;
    resolve();
  }
);

for (const wrap of [many, value => finalValue(many(value))]) {
  test.asPromise(
    'readableFrom: a wrapped value from a cancelled next is released',
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
      const stream = readableFrom(() => ({
        next() {
          startNext();
          return new Promise(resolve => (finishNext = resolve));
        },
        return: () => ({done: true})
      }));
      stream.resume();
      await started;
      const done = closed(stream);
      stream.destroy();
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
  'readableFrom: pending nested iterators are returned inside out at once',
  async (t, resolve) => {
    let finishNext, finishInner, startNext, startReturn;
    const started = new Promise(resolve => (startNext = resolve));
    const returning = new Promise(resolve => (startReturn = resolve));
    const order = [];
    const inner = {
      next() {
        startNext();
        return new Promise(resolve => (finishNext = resolve));
      },
      return() {
        order.push('inner');
        finishNext({done: true});
        return new Promise(resolve => {
          finishInner = resolve;
          startReturn();
        });
      }
    };
    const stream = readableFrom(function* () {
      try {
        yield many(inner);
      } finally {
        order.push('outer');
      }
    });
    stream.resume();
    await started;
    const done = closed(stream);
    stream.destroy();
    try {
      t.ok(await settlesBeforeSource(done));
      t.deepEqual(order, ['inner', 'outer']);
    } finally {
      if (!finishInner) finishNext({done: true});
      await returning;
      finishInner({done: true});
      await done;
    }
    resolve();
  }
);

test.asPromise(
  'readableFrom: background cleanup failures do not become errors',
  async (t, resolve) => {
    const failure = new Error('background cleanup');
    let startNext, finishNext;
    const started = new Promise(resolve => (startNext = resolve));
    const stream = readableFrom(() => ({
      next() {
        startNext();
        return new Promise(resolve => (finishNext = resolve));
      },
      return: () => Promise.reject(failure)
    }));
    const errors = [];
    stream.on('error', error => errors.push(error));
    stream.resume();
    await started;
    const done = closed(stream);
    stream.destroy();
    t.ok(await settlesBeforeSource(done));
    finishNext({done: true});
    await done;
    await new Promise(resolve => setTimeout(resolve, 0));
    t.deepEqual(errors, []);
    resolve();
  }
);

for (const web of [false, true]) {
  test.asPromise(
    `readable sources: a pending yielded promise does not hold teardown (Web ${web})`,
    async (t, resolve) => {
      let finishValue, startNext, rejectCleanup;
      const value = new Promise(resolve => (finishValue = resolve));
      const started = new Promise(resolve => (startNext = resolve));
      const cleanup = new Promise((resolve, reject) => (rejectCleanup = reject));
      let returns = 0;
      const source = () => ({
        next() {
          startNext();
          return {value, done: false};
        },
        return() {
          ++returns;
          return cleanup;
        }
      });
      const stream = web ? readableWebStreamFrom(source) : readableFrom(source);
      const errors = [];
      let reader;
      if (web) {
        reader = stream.getReader();
        reader.read().catch(() => {});
      } else {
        stream.on('error', error => errors.push(error));
        stream.resume();
      }
      await started;
      const done = web
        ? reader.cancel().then(
            () => null,
            error => error
          )
        : closed(stream);
      if (!web) stream.destroy();
      t.ok(await settlesBeforeSource(done));
      t.equal(returns, 1);
      rejectCleanup(new Error('background cleanup failed'));
      finishValue('unused');
      t.equal(await done, web ? null : undefined);
      await new Promise(resolve => setTimeout(resolve, 0));
      t.deepEqual(errors, []);
      resolve();
    }
  );
}

test.asPromise(
  'readableFrom: aborting inside a synchronous generator still releases it',
  async (t, resolve) => {
    const controller = new AbortController();
    let finishReturn;
    const returned = new Promise(resolve => (finishReturn = resolve));
    let releases = 0;
    const iterator = (function* () {
      try {
        controller.abort();
        yield 1;
      } finally {
        ++releases;
        finishReturn();
      }
    })();
    const stream = readableFrom({iterable: iterator, signal: controller.signal});
    const errors = [];
    stream.on('error', error => errors.push(error));
    const done = closed(stream);
    stream.resume();
    t.ok(await settlesBeforeSource(returned));
    await done;
    t.equal(releases, 1);
    t.equal(errors.length, 1);
    t.equal(errors[0].code, 'ABORT_ERR');
    resolve();
  }
);
