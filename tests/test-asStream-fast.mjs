'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import {none, stop, many, finalValue, flushable} from '../src/defs.js';
import gen from '../src/gen.js';
import asStream from '../src/asStream.js';

test.asPromise('asStream fast: sync function list', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        x => x * 2,
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [3, 5, 7]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});

test.asPromise('asStream fast: none filtering', (t, resolve) => {
  const result = [],
    stream = asStream(gen(x => (x % 2 === 0 ? none : x))),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [1, 3, 5]);
    resolve();
  });

  for (let i = 1; i <= 6; ++i) stream.write(i);
  stream.end();
});

test.asPromise('asStream fast: stop terminates', (t, resolve) => {
  const result = [],
    stream = asStream(gen(x => (x === 3 ? stop : x))),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [1, 2]);
    resolve();
  });

  for (let i = 1; i <= 5; ++i) stream.write(i);
  stream.end();
});

test.asPromise('asStream fast: many expansion', (t, resolve) => {
  const result = [],
    stream = asStream(gen(x => many([x, x * 10]))),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [1, 10, 2, 20, 3, 30]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});

test.asPromise('asStream fast: many then function', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        x => many([x, x * 10]),
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [2, 11, 3, 21, 4, 31]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});

test.asPromise('asStream fast: finalValue skips rest', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        x => finalValue(x * 2),
        x => x + 1000
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [2, 4, 6]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});

test.asPromise('asStream fast: async function in list', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        delay(x => x * 2, 5),
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [3, 5, 7]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});

test.asPromise('asStream fast: generator in list', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        function* (x) {
          yield x;
          yield x * 10;
        },
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [2, 11, 3, 21]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.end();
});

test.asPromise('asStream fast: async generator in list', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        async function* (x) {
          yield x;
          yield x * 10;
        },
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [2, 11, 3, 21]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.end();
});

test.asPromise('asStream fast: flushable function', (t, resolve) => {
  let flushed = false;
  const result = [],
    stream = asStream(
      gen(
        flushable(
          x => x * 2,
          () => {
            flushed = true;
            return 999;
          }
        )
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.ok(flushed);
    t.deepEqual(result, [2, 4, 999]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.end();
});

test.asPromise('asStream fast: flushable with downstream', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(
        flushable(
          x => x,
          () => 100
        ),
        x => x + 1
      )
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [2, 3, 101]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.end();
});

test.asPromise('asStream fast: mixed none/many/value', (t, resolve) => {
  const result = [],
    stream = asStream(
      gen(x => {
        if (x === 1) return none;
        if (x === 2) return many([20, 21]);
        return x;
      })
    ),
    pipeline = stream.pipe(streamToArray(result));

  pipeline.on('finish', () => {
    t.deepEqual(result, [20, 21, 3]);
    resolve();
  });

  stream.write(1);
  stream.write(2);
  stream.write(3);
  stream.end();
});
