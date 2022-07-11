'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain, {none, finalValue, many, gen} from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

test.asPromise('gen: smoke test', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: final', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: nothing', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: empty', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, gen(), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('gen: async', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: generator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: many', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2, 3]),
      gen(
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

test.asPromise('gen: combined', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      gen(
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

test.asPromise('gen: combined final', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      gen(
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

test.asPromise('gen: iterator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      gen(
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

test.asPromise('gen: async iterator', (t, resolve) => {
  const output = [],
    c = chain([
      fromIterable([1, 2]),
      gen(
        delay(x => -x),
        x => many([x, x * 10]),
        async function* (x) {
          yield delay(x => x)(x);
          yield delay(x => finalValue(x - 1))(x);
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
