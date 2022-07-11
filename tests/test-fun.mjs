'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain, {none, finalValue, many} from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

import fun from '../src/fun.js';

test.asPromise('fun: smoke test', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        x => x * x,
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('fun: final', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        x => x * x,
        x => finalValue(x),
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('fun: nothing', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        x => x * x,
        () => none,
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, []);
    resolve();
  });
});

test.asPromise('fun: empty', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, fun(), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('fun: async', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        delay(x => x * x),
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('fun: generator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        x => x * x,
        function* (x) {
          yield x;
          yield x + 1;
          yield x + 2;
        },
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
    resolve();
  });
});

test.asPromise('fun: many', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      fun(
        x => x * x,
        x => many([x, x + 1, x + 2]),
        x => 2 * x + 1
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 5, 7, 9, 11, 13, 19, 21, 23]);
    resolve();
  });
});

test.asPromise('fun: combined', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      fun(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield x - 1;
        },
        x => -x
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2, 10, 11, 2, 3, 20, 21]);
    resolve();
  });
});

test.asPromise('fun: combined final', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      fun(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield finalValue(x - 1);
        },
        x => -x
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, -2, 10, -11, 2, -3, 20, -21]);
    resolve();
  });
});

test.asPromise('fun: as fun', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      fun(
        delay(x => -x),
        x => many([x, x * 10]),
        function* (x) {
          yield x;
          yield finalValue(x - 1);
        },
        x => -x
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [1, -2, 10, -11, 2, -3, 20, -21]);
    resolve();
  });
});
