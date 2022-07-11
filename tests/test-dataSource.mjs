'use strict';

import test from 'tape-six';

import {streamToArray, delay} from './helpers.mjs';
import chain, {dataSource} from '../src/index.js';

test.asPromise('dataSource: smoke test', (t, resolve) => {
  const output = [],
    c = chain([dataSource([1, 2, 3]), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });

  c.end(1); // start the chain
});

test.asPromise('dataSource: function', (t, resolve) => {
  const output = [],
    c = chain([dataSource(() => 0), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });

  c.end(1); // start the chain
});

test.asPromise('dataSource: async function', (t, resolve) => {
  const output = [],
    c = chain([dataSource(delay(() => 0)), streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [0]);
    resolve();
  });

  c.end(1); // start the chain
});

test.asPromise('dataSource: generator', (t, resolve) => {
  const output = [],
    c = chain([
      dataSource(function* () {
        yield 0;
        yield 1;
      }),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });

  c.end(1); // start the chain
});

test.asPromise('dataSource: async generator', (t, resolve) => {
  const output = [],
    c = chain([
      dataSource(async function* () {
        yield delay(() => 0)();
        yield delay(() => 1)();
      }),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });

  c.end(1); // start the chain
});

test.asPromise('dataSource: nextable', (t, resolve) => {
  const output = [],
    c = chain([
      dataSource(
        (function* () {
          yield 0;
          yield 1;
        })()
      ),
      streamToArray(output)
    ]);

  c.on('end', () => {
    t.deepEqual(output, [0, 1]);
    resolve();
  });

  c.end(1); // start the chain
});
