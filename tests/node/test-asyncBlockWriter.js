'use strict';

import test from 'tape-six';

import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import asyncBlockWriter from '../../src/utils/asyncBlockWriter.js';
import {none} from '../../src/defs.js';

test.asPromise('asyncBlockWriter: overlapping block writes share one open', async (t, resolve) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  try {
    const path = join(dir, 'out.txt');
    const sink = asyncBlockWriter(path, {writeBlockSize: 4});
    await Promise.all([sink('aaaa'), sink('bbbb')]);
    await sink(none);
    t.equal(await readFile(path, 'utf8'), 'aaaabbbb');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('asyncBlockWriter: the tail is written once on flush', async (t, resolve) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  try {
    const path = join(dir, 'out.txt');
    const sink = asyncBlockWriter(path, {writeBlockSize: 4});
    await sink('aaaa');
    await sink('bb');
    await sink(none);
    t.equal(await readFile(path, 'utf8'), 'aaaabb');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});
