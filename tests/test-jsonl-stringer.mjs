'use strict';

import test from 'tape-six';

import {Writable, Transform} from 'stream';

import {readString} from './helpers.mjs';

import parser from '../src/jsonl/parser.js';
import stringer from '../src/jsonl/stringer.js';

test.asPromise('jsonl stringer: smoke test', (t, resolve) => {
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
    .pipe(parser())
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
    .pipe(stringer())
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

test.asPromise('jsonl stringer: multiple', (t, resolve) => {
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
    .pipe(parser())
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
    .pipe(stringer())
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
