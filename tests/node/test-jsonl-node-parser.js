'use strict';

import test from 'tape-six';

import {Writable} from 'node:stream';

import {readString} from '../helpers.js';

import jsonlParser, {parser, jsonlParser as rawJsonlParser} from '../../src/node/jsonl/parser.js';
import {jsonlParser as barrelParser} from '../../src/node/jsonl/index.js';

test('jsonl node parser: surface', t => {
  t.equal(typeof jsonlParser, 'function');
  t.equal(parser, jsonlParser, 'named parser === default');
  t.equal(barrelParser, jsonlParser, 'barrel jsonlParser === default');
  t.equal(typeof jsonlParser.asStream, 'function', '.asStream attached');
  t.equal(typeof jsonlParser.asWebStream, 'function', '.asWebStream attached');
  t.equal(typeof rawJsonlParser, 'function', 'raw per-line factory exported');
});

test('jsonl node parser: factory call returns the gen chain (per-line raw factory works)', t => {
  const p = rawJsonlParser();
  t.deepEqual(p('{"a":1}'), {key: 0, value: {a: 1}});
  t.deepEqual(p('{"b":2}'), {key: 1, value: {b: 2}});
});

test.asPromise('jsonl node parser: asStream round-trips', (t, resolve) => {
  const objects = [{a: 1}, {b: 2}, {c: 3}];
  const input = objects.map(o => JSON.stringify(o)).join('\n');
  const result = [];
  readString(input, 4)
    .pipe(jsonlParser.asStream())
    .pipe(
      new Writable({
        objectMode: true,
        write(chunk, _, callback) {
          result.push(chunk.value);
          callback(null);
        },
        final(callback) {
          t.deepEqual(result, objects);
          resolve();
          callback(null);
        }
      })
    );
});

test.asPromise('jsonl node parser: asWebStream round-trips', async (t, resolve) => {
  const objects = [{x: 1}, {y: 2}];
  const input = objects.map(o => JSON.stringify(o)).join('\n');
  const p = jsonlParser.asWebStream();
  // Write concurrently with the drain — the TransformStream readable side has
  // HWM 0, so awaiting close() before reading would deadlock on backpressure.
  const writePromise = (async () => {
    const writer = p.writable.getWriter();
    await writer.write(input);
    await writer.close();
  })();
  const out = [];
  for await (const v of p.readable) out.push(v.value);
  await writePromise;
  t.deepEqual(out, objects);
  resolve();
});
