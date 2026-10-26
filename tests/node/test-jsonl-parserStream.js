'use strict';

import test from 'tape-six';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {Writable} from 'node:stream';

import {readString} from '../helpers.js';

import parserStream from '../../src/jsonl/parserStream.js';
import {whenReady} from '../../src/utils/fixUtf8Stream.js';

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
      '../data/sample.jsonl.gz'
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
  pipeline.on('end', () => {
    t.fail("We shouldn't be here.");
    resolve();
  });
});

test.asPromise('jsonl parserStream: ignoreErrors drops bad lines silently', (t, resolve) => {
  const good = {a: 1};
  const input = ['not json', JSON.stringify(good), 'also not json'].join('\n');
  const out = [];

  readString(input)
    .pipe(parserStream({ignoreErrors: true}))
    .pipe(
      new Writable({
        objectMode: true,
        write(chunk, _, callback) {
          out.push(chunk);
          callback(null);
        },
        final(callback) {
          // Bad lines map to `defs.none` inside the parser and are filtered out
          // by asStream — no envelope reaches userland. `key` preserves the
          // source line index of the surviving record.
          t.equal(out.length, 1, 'only valid lines emit');
          t.deepEqual(out[0], {key: 1, value: good});
          resolve();
          callback(null);
        }
      })
    );
});

test.asPromise('parserStream: a leading BOM is dropped', async (t, resolve) => {
  await whenReady(); // on Node, the StringDecoder path, which keeps a BOM on its own
  const out = [];
  const stream = parserStream();
  stream.on('data', item => out.push(item.value));
  stream.on('end', () => {
    t.deepEqual(out, [{a: 1}, {b: 2}]);
    resolve();
  });
  stream.end(Buffer.from('\uFEFF{"a":1}\n{"b":2}', 'utf8'));
});

test.asPromise('parserStream: ignoreBOM keeps the BOM', (t, resolve) => {
  const stream = parserStream({ignoreBOM: true});
  stream.on('data', () => {});
  stream.on('error', error => {
    t.ok(error instanceof SyntaxError, 'the kept BOM fails JSON.parse');
    resolve();
  });
  stream.end(Buffer.from('\uFEFF{"a":1}', 'utf8'));
});
