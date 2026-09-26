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
