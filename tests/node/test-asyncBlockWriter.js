'use strict';

import test from 'tape-six';

import {mkdtemp, open, readFile, rm} from 'node:fs/promises';
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

test.asPromise(
  'asyncBlockWriter: an unawaited flush waits for pending block writes',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    try {
      const path = join(dir, 'out.txt');
      const sink = asyncBlockWriter(path, {writeBlockSize: 4});
      await Promise.all([sink('aaaa'), sink('bbbb'), sink('cc'), sink(none)]);
      t.equal(await readFile(path, 'utf8'), 'aaaabbbbcc');
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: many overlapping block writes keep call order',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    try {
      const path = join(dir, 'out.txt'),
        size = 1 << 16,
        letters = 'abcdefghij';
      const sink = asyncBlockWriter(path, {writeBlockSize: size});
      await Promise.all([...letters].map(c => sink(c.repeat(size))));
      await sink(none);
      const text = await readFile(path, 'utf8');
      t.equal(text.length, size * letters.length);
      t.equal([...letters].map((_, i) => text[i * size]).join(''), letters);
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: a failed write does not stall the calls behind it',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    const probe = await open(join(dir, 'probe'), 'w');
    const FH = Object.getPrototypeOf(probe),
      write = FH.write;
    await probe.close();
    try {
      const path = join(dir, 'out.txt');
      const sink = asyncBlockWriter(path, {writeBlockSize: 4});
      const boom = new Error('write boom');
      FH.write = function (...args) {
        if (args[0] === 'aaaa') throw boom;
        return write.apply(this, args);
      };
      const [first, second] = await Promise.allSettled([sink('aaaa'), sink('bbbb')]);
      t.equal(first.status, 'rejected');
      t.equal(first.reason, boom);
      t.equal(second.status, 'fulfilled');
      await sink(none);
      t.equal(await readFile(path, 'utf8'), 'bbbb');
    } finally {
      FH.write = write;
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

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
