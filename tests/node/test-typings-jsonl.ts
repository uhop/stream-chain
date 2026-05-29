import test from 'tape-six';

import jsonlParser from '../../src/node/jsonl/parser.js';
import type {JsonlParserOptions, JsonlItem} from '../../src/node/jsonl/parser.js';
import jsonlStringer from '../../src/node/jsonl/stringer.js';
import type {JsonlStringerOptions} from '../../src/node/jsonl/stringer.js';
import {
  jsonlParser as barrelParser,
  jsonlStringer as barrelStringer
} from '../../src/node/jsonl/index.js';

// Type-level: options resolve and accept the documented fields (incl. the no-op
// `checkErrors` kept for stream-json compatibility) plus Node stream options.
const parserOpts: JsonlParserOptions = {
  reviver: (_k, v) => v,
  ignoreErrors: true,
  checkErrors: true
};
const stringerOpts: JsonlStringerOptions = {
  separator: '\n',
  prefix: '',
  suffix: '',
  highWaterMark: 16
};

// Type-level: item shape is generic in the value type.
const sampleItem: JsonlItem<{a: number}> = {key: 0, value: {a: 1}};

test.asPromise('typings jsonl: node parser asStream is a Duplex round-trip', (t, resolve) => {
  const result: unknown[] = [];
  const dup = jsonlParser.asStream(parserOpts);
  dup.on('data', (d: JsonlItem) => result.push(d.value));
  dup.on('end', () => {
    t.deepEqual(result, [{a: 1}]);
    resolve();
  });
  dup.end(JSON.stringify(sampleItem.value));
});

test('typings jsonl: stringer factory + barrel identities', t => {
  const s = jsonlStringer(stringerOpts); // Node Transform
  t.ok(s);
  t.equal(barrelParser, jsonlParser);
  t.equal(barrelStringer, jsonlStringer);
});
