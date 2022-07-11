'use strict';

import test from 'tape-six';

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {Writable} from 'stream';

import {readString} from './helpers.mjs';
import chain from '../src/index.js';

import parser from '../src/jsonl/parser.js';

const roundtrip = (t, resolve, len, quant) => {
  const objects = [];
  for (let n = 0; n < len; n += 1) {
    objects.push({
      stringWithTabsAndNewlines: "Did it work?\nNo...\t\tI don't think so...",
      anArray: [n + 1, n + 2, true, 'tabs?\t\t\t\u0001\u0002\u0003', false],
      n
    });
  }

  const json = [];
  for (let n = 0; n < objects.length; n += 1) {
    json.push(JSON.stringify(objects[n]));
  }

  const input = json.join('\n'),
    result = [];
  chain([
    readString(input, quant),
    parser(),
    new Writable({
      objectMode: true,
      write(chunk, _, callback) {
        result.push(chunk.value);
        callback(null);
      },
      final(callback) {
        t.deepEqual(objects, result);
        resolve();
        callback(null);
      }
    })
  ]);
};

test.asPromise('jsonl parser: smoke test', (t, resolve) => roundtrip(t, resolve));

test.asPromise('jsonl parser: roundtrip with 1 set of objects', (t, resolve) => {
  roundtrip(t, resolve, 1);
});

test.asPromise('jsonl parser: roundtrip with 2 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 2);
});

test.asPromise('jsonl parser: roundtrip with 3 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 3);
});

test.asPromise('jsonl parser: roundtrip with 4 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 4);
});

test.asPromise('jsonl parser: roundtrip with 5 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 5);
});

test.asPromise('jsonl parser: roundtrip with 6 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 6);
});

test.asPromise('jsonl parser: roundtrip with 7 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 7);
});

test.asPromise('jsonl parser: roundtrip with 8 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 8);
});

test.asPromise('jsonl parser: roundtrip with 9 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 9);
});

test.asPromise('jsonl parser: roundtrip with 10 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 10);
});

test.asPromise('jsonl parser: roundtrip with 11 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 11);
});

test.asPromise('jsonl parser: roundtrip with 12 sets of objects', (t, resolve) => {
  roundtrip(t, resolve, 12);
});

for (let i = 1; i <= 12; ++i) {
  test.asPromise('jsonl parser: roundtrip with different window sizes - ' + i, (t, resolve) => {
    roundtrip(t, resolve, 10, i);
  });
}

test.asPromise('jsonl parser: read file', (t, resolve) => {
  if (!/^file:\/\//.test(import.meta.url)) throw Error('Cannot get the current working directory');
  const fileName = path.join(path.dirname(import.meta.url.substring(7)), './data/sample.jsonl.gz');
  let count = 0;
  chain([
    fs.createReadStream(fileName),
    zlib.createGunzip(),
    parser(),
    new Writable({
      objectMode: true,
      write(chunk, _, callback) {
        t.equal(count, chunk.key);
        ++count;
        callback(null);
      },
      final(callback) {
        t.equal(count, 100);
        resolve();
        callback(null);
      }
    })
  ]);
});

test.asPromise('jsonl parser: bad json', (t, resolve) => {
  const pipeline = chain([readString(' not json '), parser()]);

  pipeline.on('data', () => t.fail("We shouldn't be here."));
  pipeline.on('error', e => {
    t.ok(e);
    resolve();
  });
  pipeline.on('end', value => {
    t.fail("We shouldn't be here.");
    resolve();
  });
});
