'use strict';

import test from 'tape-six';

import {Writable, Transform} from 'node:stream';

import {readString, writeToArray} from './helpers.mjs';

import parserStream from '../src/jsonl/parserStream.js';
import stringerStream from '../src/jsonl/stringerStream.js';

test.asPromise('jsonl stringerStream: smoke test', (t, resolve) => {
  const pattern = {
      a: [[[]]],
      b: {a: 1},
      c: {a: 1, b: 2},
      d: [true, 1, "'x\"y'", null, false, true, {}, [], ''],
      e: 1,
      f: '',
      g: true,
      h: false,
      i: null,
      j: [],
      k: {}
    },
    string = JSON.stringify(pattern);

  let buffer = '';
  readString(string)
    .pipe(parserStream())
    .pipe(
      new Transform({
        writableObjectMode: true,
        readableObjectMode: true,
        transform(chunk, _, callback) {
          this.push(chunk.value);
          callback(null);
        }
      })
    )
    .pipe(stringerStream())
    .pipe(
      new Writable({
        write(chunk, _, callback) {
          buffer += chunk;
          callback(null);
        },
        final(callback) {
          t.deepEqual(string, buffer);
          resolve();
          callback(null);
        }
      })
    );
});

test.asPromise('jsonl stringerStream: multiple', (t, resolve) => {
  const pattern = {
    a: [[[]]],
    b: {a: 1},
    c: {a: 1, b: 2},
    d: [true, 1, "'x\"y'", null, false, true, {}, [], ''],
    e: 1,
    f: '',
    g: true,
    h: false,
    i: null,
    j: [],
    k: {}
  };

  let string = JSON.stringify(pattern),
    buffer = '';
  string = string + '\n' + string + '\n' + string;

  readString(string + '\n')
    .pipe(parserStream())
    .pipe(
      new Transform({
        writableObjectMode: true,
        readableObjectMode: true,
        transform(chunk, _, callback) {
          this.push(chunk.value);
          callback(null);
        }
      })
    )
    .pipe(stringerStream())
    .pipe(
      new Writable({
        write(chunk, _, callback) {
          buffer += chunk;
          callback(null);
        },
        final(callback) {
          t.deepEqual(string, buffer);
          resolve();
          callback(null);
        }
      })
    );
});

test.asPromise('jsonl stringerStream: custom separators - one value', (t, resolve) => {
  const output = [],
    stringer = stringerStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    pipeline = stringer.pipe(writeToArray(output));

  pipeline.on('finish', () => {
    t.equal(output.join(''), '[1]');
    resolve();
  });

  stringer.end(1);
});

test.asPromise('jsonl stringerStream: custom separators - two value', (t, resolve) => {
  const output = [],
    stringer = stringerStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    pipeline = stringer.pipe(writeToArray(output));

  pipeline.on('finish', () => {
    t.equal(output.join(''), '[2,1]');
    resolve();
  });

  stringer.write(2);
  stringer.end(1);
});

test.asPromise('jsonl stringerStream: custom separators - no value', (t, resolve) => {
  const output = [],
    stringer = stringerStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    pipeline = stringer.pipe(writeToArray(output));

  pipeline.on('finish', () => {
    t.equal(output.join(''), '{}');
    resolve();
  });

  stringer.end();
});

test.asPromise('jsonl stringerStream: custom separators - no value (default)', (t, resolve) => {
  const output = [],
    stringer = stringerStream({prefix: '[', suffix: ']', separator: ','}),
    pipeline = stringer.pipe(writeToArray(output));

  pipeline.on('finish', () => {
    t.equal(output.join(''), '[]');
    resolve();
  });

  stringer.end();
});
