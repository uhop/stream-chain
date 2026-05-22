'use strict';

import test from 'tape-six';

import {writeAndCollect} from '../web-helpers.js';
import stringerWebStream from '../../src/jsonl/stringerWebStream.js';

test.asPromise('jsonl stringerWebStream: smoke test', async (t, resolve) => {
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
  const out = await writeAndCollect(stringerWebStream(), [pattern]);
  t.equal(out.join(''), JSON.stringify(pattern));
  resolve();
});

test.asPromise('jsonl stringerWebStream: multiple values', async (t, resolve) => {
  const a = {a: 1},
    b = {b: 2},
    c = {c: 3};
  const out = await writeAndCollect(stringerWebStream(), [a, b, c]);
  t.equal(out.join(''), [a, b, c].map(v => JSON.stringify(v)).join('\n'));
  resolve();
});

test.asPromise('jsonl stringerWebStream: custom separators - one value', async (t, resolve) => {
  const out = await writeAndCollect(
    stringerWebStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    [1]
  );
  t.equal(out.join(''), '[1]');
  resolve();
});

test.asPromise('jsonl stringerWebStream: custom separators - two values', async (t, resolve) => {
  const out = await writeAndCollect(
    stringerWebStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    [2, 1]
  );
  t.equal(out.join(''), '[2,1]');
  resolve();
});

test.asPromise('jsonl stringerWebStream: custom separators - no value', async (t, resolve) => {
  const out = await writeAndCollect(
    stringerWebStream({emptyValue: '{}', prefix: '[', suffix: ']', separator: ','}),
    []
  );
  t.equal(out.join(''), '{}');
  resolve();
});

test.asPromise(
  'jsonl stringerWebStream: custom separators - no value (default emptyValue)',
  async (t, resolve) => {
    const out = await writeAndCollect(
      stringerWebStream({prefix: '[', suffix: ']', separator: ','}),
      []
    );
    t.equal(out.join(''), '[]');
    resolve();
  }
);

test.asPromise('jsonl stringerWebStream: replacer + space', async (t, resolve) => {
  const out = await writeAndCollect(
    stringerWebStream({
      replacer: (_k, v) => (typeof v === 'number' ? v * 2 : v),
      space: 2
    }),
    [{a: 1}]
  );
  t.equal(out.join(''), JSON.stringify({a: 2}, null, 2));
  resolve();
});

test.asPromise('jsonl stringerWebStream: has TransformStream shape', (t, resolve) => {
  const s = stringerWebStream();
  t.ok(s.readable, 'has readable side');
  t.ok(s.writable, 'has writable side');
  t.equal(typeof s.readable.pipeTo, 'function');
  t.equal(typeof s.writable.getWriter, 'function');
  resolve();
});
