'use strict';

import test from 'tape-six';

import {runChain} from '../web-helpers.js';

import lines from '../../src/utils/lines.js';

test.asPromise('lines: LF and CRLF in one chunk', async (t, resolve) => {
  const out = await runChain([lines()], ['a\nb\r\nc']);
  t.deepEqual(out, ['a', 'b', 'c']);
  resolve();
});

test.asPromise('lines: a line across chunks', async (t, resolve) => {
  const out = await runChain([lines()], ['ab', 'c\nd', 'e\n']);
  t.deepEqual(out, ['abc', 'de']);
  resolve();
});

test.asPromise('lines: CRLF split across chunks', async (t, resolve) => {
  const out = await runChain([lines()], ['abc\r', '\ndef\r', '\n']);
  t.deepEqual(out, ['abc', 'def']);
  resolve();
});

test.asPromise('lines: a lone CR stays in the line', async (t, resolve) => {
  const out = await runChain([lines()], ['a\r', 'b\n']);
  t.deepEqual(out, ['a\rb']);
  resolve();
});
