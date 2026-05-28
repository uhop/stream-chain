'use strict';

import test from 'tape-six';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {Writable} from 'node:stream';

import {readString} from '../helpers.js';
import chain from '../../src/index.js';

import parser from '../../src/jsonl/parser.js';

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

for (let i = 1; i <= 12; ++i) {
  test.asPromise('jsonl parser: roundtrip with a set of objects - ' + i, (t, resolve) => {
    roundtrip(t, resolve, i);
  });
}

for (let i = 1; i <= 12; ++i) {
  test.asPromise('jsonl parser: roundtrip with different window sizes - ' + i, (t, resolve) => {
    roundtrip(t, resolve, 10, i);
  });
}

test.asPromise('jsonl parser: read file', (t, resolve) => {
  if (!/^file:\/\//.test(import.meta.url)) throw Error('Cannot get the current working directory');
  const isWindows = path.sep === '\\',
    fileName = path.join(
      path.dirname(import.meta.url.substring(isWindows ? 8 : 7)),
      '../data/sample.jsonl.gz'
    );
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
  pipeline.on('end', () => {
    t.fail("We shouldn't be here.");
    resolve();
  });
});

const collectPipeline = (input, options) =>
  new Promise((resolve, reject) => {
    const out = [];
    const pipeline = chain([
      readString(input),
      parser(options),
      new Writable({
        objectMode: true,
        write(chunk, _, cb) {
          out.push(chunk);
          cb(null);
        },
        final(cb) {
          resolve(out);
          cb(null);
        }
      })
    ]);
    pipeline.on('error', reject);
  });

test.asPromise(
  'jsonl parser: ignoreErrors drops bad lines (counter bumps regardless)',
  async (t, resolve) => {
    // Back-compat: `ignoreErrors` bumps the counter on every line including the
    // dropped ones, so keys reflect the source line index with gaps for failures.
    // `errorIndicator: undefined` is the sequential-on-emit alternative.
    const out = await collectPipeline('{\n1\n]\n2\n3', {ignoreErrors: true});
    t.deepEqual(out, [
      {key: 1, value: 1},
      {key: 3, value: 2},
      {key: 4, value: 3}
    ]);
    resolve();
  }
);

test.asPromise('jsonl parser: errorIndicator undefined drops bad lines', async (t, resolve) => {
  const out = await collectPipeline('{\n1\n]\n2\n3', {errorIndicator: undefined});
  t.deepEqual(out, [
    {key: 0, value: 1},
    {key: 1, value: 2},
    {key: 2, value: 3}
  ]);
  resolve();
});

test.asPromise('jsonl parser: errorIndicator null replaces bad lines', async (t, resolve) => {
  const out = await collectPipeline('{\n1\n]\n2\n3', {errorIndicator: null});
  t.deepEqual(out, [
    {key: 0, value: null},
    {key: 1, value: 1},
    {key: 2, value: null},
    {key: 3, value: 2},
    {key: 4, value: 3}
  ]);
  resolve();
});

test.asPromise('jsonl parser: errorIndicator function transforms bad lines', async (t, resolve) => {
  const out = await collectPipeline('{\n1\n]\n2\n3', {errorIndicator: error => error.name});
  t.deepEqual(out, [
    {key: 0, value: 'SyntaxError'},
    {key: 1, value: 1},
    {key: 2, value: 'SyntaxError'},
    {key: 3, value: 2},
    {key: 4, value: 3}
  ]);
  resolve();
});

test.asPromise('jsonl parser: errorIndicator function receives raw input', async (t, resolve) => {
  const out = await collectPipeline('{\n1\n]\n2\n3', {errorIndicator: (_, input) => input});
  t.deepEqual(out, [
    {key: 0, value: '{'},
    {key: 1, value: 1},
    {key: 2, value: ']'},
    {key: 3, value: 2},
    {key: 4, value: 3}
  ]);
  resolve();
});

test.asPromise(
  'jsonl parser: errorIndicator function returning undefined drops bad lines',
  async (t, resolve) => {
    const out = await collectPipeline('{\n1\n]\n2\n3', {errorIndicator: () => undefined});
    t.deepEqual(out, [
      {key: 0, value: 1},
      {key: 1, value: 2},
      {key: 2, value: 3}
    ]);
    resolve();
  }
);

test.asPromise(
  'jsonl parser: errorIndicator wins over ignoreErrors when both set',
  async (t, resolve) => {
    const out = await collectPipeline('{\n1\n]\n2\n3', {
      ignoreErrors: true,
      errorIndicator: null
    });
    t.deepEqual(out, [
      {key: 0, value: null},
      {key: 1, value: 1},
      {key: 2, value: null},
      {key: 3, value: 2},
      {key: 4, value: 3}
    ]);
    resolve();
  }
);

test.asPromise('jsonl parser: empty lines dropped by default', async (t, resolve) => {
  const out = await collectPipeline('\n1\n\n2\n\n\n3\n');
  t.deepEqual(out, [
    {key: 0, value: 1},
    {key: 1, value: 2},
    {key: 2, value: 3}
  ]);
  resolve();
});
