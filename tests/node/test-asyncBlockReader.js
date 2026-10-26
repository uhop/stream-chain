'use strict';

import test from 'tape-six';

import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import asyncBlockReader from '../../src/utils/asyncBlockReader.js';

const BOM = [0xef, 0xbb, 0xbf];
const encode = text => [...new TextEncoder().encode(text)];

const readAll = async (path, options) => {
  let out = '';
  for await (const s of asyncBlockReader(options)(path)) out += s;
  return out;
};

const withFile = async (bytes, fn) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-reader-'));
  try {
    const path = join(dir, 'in.txt');
    await writeFile(path, Uint8Array.from(bytes));
    await fn(path);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
};

test.asPromise('asyncBlockReader: a leading BOM is dropped', async (t, resolve) => {
  await withFile([...BOM, ...encode('ab')], async path => {
    t.equal(await readAll(path), 'ab');
    t.equal(await readAll(path, {readBlockSize: 1}), 'ab', 'split 1+1+1');
    t.equal(await readAll(path, {readBlockSize: 2}), 'ab', 'split 2+1');
  });
  resolve();
});

test.asPromise('asyncBlockReader: only the leading BOM is dropped', async (t, resolve) => {
  await withFile([...BOM, ...BOM, ...encode('a'), ...BOM, ...encode('b')], async path => {
    t.equal(await readAll(path), '\uFEFFa\uFEFFb');
    t.equal(await readAll(path, {readBlockSize: 1}), '\uFEFFa\uFEFFb', 'split into single bytes');
  });
  resolve();
});

test.asPromise('asyncBlockReader: ignoreBOM keeps the BOM', async (t, resolve) => {
  await withFile([...BOM, ...encode('ab')], async path => {
    t.equal(await readAll(path, {ignoreBOM: true}), '\uFEFFab');
  });
  resolve();
});
