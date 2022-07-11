'use strict';

import test from 'tape-six';

import {streamToArray} from './helpers.mjs';
import chain from '../src/index.js';
import fromIterable from '../src/utils/readableFrom.js';

test.asPromise('readWrite: readable', (t, resolve) => {
  const output1 = [],
    output2 = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x]);

  c.pipe(streamToArray(output1));

  c.on('data', value => output2.push(value));
  c.on('end', () => {
    t.deepEqual(output1, [1, 4, 9]);
    t.deepEqual(output2, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('readWrite: writable', (t, resolve) => {
  const output = [],
    c = chain([x => x * x, streamToArray(output)]);

  fromIterable([1, 2, 3]).pipe(c);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('readWrite: readable and writable', (t, resolve) => {
  const output = [],
    c = chain([fromIterable([1, 2, 3]), x => x * x, streamToArray(output)]);

  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('readWrite: single readable', (t, resolve) => {
  const output1 = [],
    output2 = [],
    c = chain([fromIterable([1, 2, 3])]);

  c.pipe(streamToArray(output1));

  c.on('data', value => output2.push(value));
  c.on('end', () => {
    t.deepEqual(output1, [1, 2, 3]);
    t.deepEqual(output2, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('readWrite: single writable', (t, resolve) => {
  const output = [],
    c = chain([streamToArray(output)]);

  fromIterable([1, 2, 3]).pipe(c);

  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('readWrite: pipeable', (t, resolve) => {
  const output1 = [],
    output2 = [],
    c = chain([fromIterable([1, 2, 3]), streamToArray(output1)]);

  fromIterable([4, 5, 6]).pipe(c).pipe(streamToArray(output2));

  c.on('end', () => {
    t.deepEqual(output1, [1, 2, 3]);
    t.deepEqual(output2, []);
    resolve();
  });
});
