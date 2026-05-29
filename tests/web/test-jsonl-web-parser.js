'use strict';

import test from 'tape-six';

import jsonlParser, {parser, jsonlParser as rawJsonlParser} from '../../src/web/jsonl/parser.js';
import {jsonlParser as barrelParser} from '../../src/web/jsonl/index.js';

const writeAll = async (writable, chunks) => {
  const writer = writable.getWriter();
  for (const c of chunks) await writer.write(c);
  await writer.close();
};

const drain = async readable => {
  const out = [];
  for await (const v of readable) out.push(v);
  return out;
};

test('jsonl web parser: surface (browser-safe, no asStream)', t => {
  t.equal(typeof jsonlParser, 'function');
  t.equal(parser, jsonlParser, 'named parser === default');
  t.equal(barrelParser, jsonlParser, 'barrel jsonlParser === default');
  t.equal(typeof jsonlParser.asWebStream, 'function', '.asWebStream attached');
  t.equal(jsonlParser.asStream, undefined, 'no .asStream on the web entry');
  t.equal(typeof rawJsonlParser, 'function', 'raw per-line factory exported');
});

test.asPromise('jsonl web parser: asWebStream round-trips', async (t, resolve) => {
  const objects = [{x: 1}, {y: 2}, {z: 3}];
  const input = objects.map(o => JSON.stringify(o)).join('\n');
  const p = jsonlParser.asWebStream();
  const writePromise = writeAll(p.writable, [input]);
  const out = await drain(p.readable);
  await writePromise;
  t.deepEqual(
    out.map(o => o.value),
    objects
  );
  resolve();
});
