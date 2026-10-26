'use strict';

import test from 'tape-six';

import {runChain} from '../web-helpers.js';

import fixUtf8Stream, {whenReady} from '../../src/utils/fixUtf8Stream.js';

const encoder = new TextEncoder(),
  REPLACEMENT = String.fromCodePoint(0xfffd);

test.asPromise('fixUtf8Stream: a multi-byte character split across chunks', async (t, resolve) => {
  await whenReady();
  const bytes = encoder.encode('a€b');
  const out = await runChain([fixUtf8Stream()], [bytes.subarray(0, 2), bytes.subarray(2)]);
  t.equal(out.join(''), 'a€b');
  resolve();
});

test.asPromise('fixUtf8Stream: strings pass through', async (t, resolve) => {
  await whenReady();
  const out = await runChain([fixUtf8Stream()], ['ab', 'c']);
  t.equal(out.join(''), 'abc');
  resolve();
});

test.asPromise(
  'fixUtf8Stream: an incomplete sequence at the end is flushed',
  async (t, resolve) => {
    await whenReady();
    const bytes = encoder.encode('a€');
    const out = await runChain([fixUtf8Stream()], [bytes.subarray(0, 2)]);
    t.equal(out.join(''), 'a' + REPLACEMENT);
    resolve();
  }
);

test('fixUtf8Stream: rejects other chunk types', t => {
  t.throws(() => fixUtf8Stream()(42), TypeError);
});

const withBOM = text => new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode(text)]);

test.asPromise('fixUtf8Stream: a leading BOM is dropped', async (t, resolve) => {
  await whenReady();
  const bytes = withBOM('ab');
  t.equal((await runChain([fixUtf8Stream()], [bytes])).join(''), 'ab');
  const splits = [
    [bytes.subarray(0, 1), bytes.subarray(1)],
    [bytes.subarray(0, 2), bytes.subarray(2)],
    [bytes.subarray(0, 1), bytes.subarray(1, 2), bytes.subarray(2)]
  ];
  for (const chunks of splits) {
    const out = await runChain([fixUtf8Stream()], chunks);
    t.equal(out.join(''), 'ab', 'split ' + chunks.map(c => c.length).join('+'));
  }
  resolve();
});

test.asPromise('fixUtf8Stream: an empty first chunk does not hide a BOM', async (t, resolve) => {
  await whenReady();
  const out = await runChain([fixUtf8Stream()], [new Uint8Array(0), withBOM('a')]);
  t.equal(out.join(''), 'a');
  resolve();
});

test.asPromise('fixUtf8Stream: only the leading BOM is dropped', async (t, resolve) => {
  await whenReady();
  const twice = await runChain([fixUtf8Stream()], [withBOM('\uFEFFa')]);
  t.equal(twice.join(''), '\uFEFFa', 'a second BOM is text');
  const later = await runChain([fixUtf8Stream()], [encoder.encode('a'), withBOM('b')]);
  t.equal(later.join(''), 'a\uFEFFb', 'a BOM after the start is text');
  resolve();
});

test.asPromise('fixUtf8Stream: ignoreBOM keeps the BOM', async (t, resolve) => {
  await whenReady();
  const out = await runChain([fixUtf8Stream({ignoreBOM: true})], [withBOM('ab')]);
  t.equal(out.join(''), '\uFEFFab');
  resolve();
});

test.asPromise('fixUtf8Stream: a string stream drops its leading BOM too', async (t, resolve) => {
  await whenReady();
  t.equal((await runChain([fixUtf8Stream()], ['\uFEFFab'])).join(''), 'ab');
  t.equal(
    (await runChain([fixUtf8Stream()], ['', '\uFEFFa'])).join(''),
    'a',
    'after an empty chunk'
  );
  t.equal(
    (await runChain([fixUtf8Stream()], ['a', '\uFEFFb'])).join(''),
    'a\uFEFFb',
    'a later one is text'
  );
  const kept = await runChain([fixUtf8Stream({ignoreBOM: true})], ['\uFEFFab']);
  t.equal(kept.join(''), '\uFEFFab', 'ignoreBOM keeps it');
  resolve();
});
