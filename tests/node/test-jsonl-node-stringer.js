'use strict';

import test from 'tape-six';

import {Readable, Writable} from 'node:stream';

import jsonlStringer, {stringer, jsonlStringer as named} from '../../src/node/jsonl/stringer.js';
import {jsonlStringer as barrelStringer} from '../../src/node/jsonl/index.js';
import jsonlParser from '../../src/node/jsonl/parser.js';

test('jsonl node stringer: surface', t => {
  t.equal(typeof jsonlStringer, 'function');
  t.equal(stringer, jsonlStringer, 'named stringer === default');
  t.equal(named, jsonlStringer, 'named jsonlStringer === default');
  t.equal(barrelStringer, jsonlStringer, 'barrel jsonlStringer === default');
  t.equal(jsonlStringer.asStream, jsonlStringer, '.asStream is the factory itself');
  t.equal(typeof jsonlStringer.asWebStream, 'function', '.asWebStream attached');
  t.equal(jsonlStringer.stringer, undefined, 'no .stringer self-alias');
});

test.asPromise('jsonl node stringer: round-trips objects -> JSONL -> objects', (t, resolve) => {
  const objects = [{a: 1}, {b: [1, 2, 3]}, {c: 'x'}];
  const result = [];
  Readable.from(objects)
    .pipe(jsonlStringer())
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

test.asPromise('jsonl node stringer: asWebStream produces JSONL text', async (t, resolve) => {
  const objects = [{a: 1}, {b: 2}];
  const ts = jsonlStringer.asWebStream();
  const writePromise = (async () => {
    const writer = ts.writable.getWriter();
    for (const o of objects) await writer.write(o);
    await writer.close();
  })();
  let text = '';
  for await (const s of ts.readable) text += s;
  await writePromise;
  t.equal(text, objects.map(o => JSON.stringify(o)).join('\n'));
  resolve();
});
