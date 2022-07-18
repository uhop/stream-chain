'use strict';

import test from 'tape-six';

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {Writable} from 'stream';

import {readString} from './helpers.mjs';

import parserStream from '../src/jsonl/parserStream.js';

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
  readString(input, quant)
    .pipe(parserStream())
    .pipe(
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
    );
};

test.asPromise('jsonl parserStream: smoke test', (t, resolve) => roundtrip(t, resolve));

for (let i = 1; i <= 12; ++i) {
  test.asPromise('jsonl parserStream: roundtrip with a set of objects - ' + i, (t, resolve) => {
    roundtrip(t, resolve, i);
  });
}

for (let i = 1; i <= 12; ++i) {
  test.asPromise(
    'jsonl parserStream: roundtrip with different window sizes - ' + i,
    (t, resolve) => {
      roundtrip(t, resolve, 10, i);
    }
  );
}

test.asPromise('jsonl parserStream: read file', (t, resolve) => {
  if (!/^file:\/\//.test(import.meta.url)) throw Error('Cannot get the current working directory');
  const isWindows = path.sep === '\\',
    fileName = path.join(
      path.dirname(import.meta.url.substring(isWindows ? 8 : 7)),
      './data/sample.jsonl.gz'
    );
  let count = 0;
  fs.createReadStream(fileName)
    .pipe(zlib.createGunzip())
    .pipe(parserStream())
    .pipe(
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
    );
});

test.asPromise('jsonl parserStream: bad json', (t, resolve) => {
  const pipeline = readString(' not json ').pipe(parserStream());

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
