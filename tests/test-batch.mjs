'use strict';

import test from 'tape-six';

import chain from '../src/index.js';

import {readString} from './helpers.mjs';
import parser from '../src/jsonl/parser.js';

import batch from '../src/utils/batch.js';

test.asPromise('batch: smoke test', (t, resolve) => {
  const pattern = [0, 1, true, false, null, {}, [], {a: 'b'}, ['c']],
    result = [],
    pipeline = chain([
      readString(pattern.map(value => JSON.stringify(value)).join('\n')),
      parser(),
      batch(2)
    ]);

  pipeline.output.on('data', batch => {
    t.ok(batch.length == 2 || batch.length == 1);
    batch.forEach(object => (result[object.key] = object.value));
  });
  pipeline.output.on('end', () => {
    t.deepEqual(pattern, result);
    resolve();
  });
});
