'use strict';

import test from 'tape-six';

import {open, mkdtemp, writeFile} from 'node:fs/promises';
import {existsSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import asyncBlockReader from '../../src/utils/asyncBlockReader.js';
import asyncBlockWriter from '../../src/utils/asyncBlockWriter.js';
import {none} from '../../src/defs.js';

// FileHandle.read/write live on the prototype (patchable); close is an own
// per-instance property (not patchable). So we inject a write/read failure via
// the prototype and prove the handle is still released afterward by counting
// open fds — the leak the fix closes. The AggregateError "close also failed"
// branch shares its combine-logic with exec()/pipe(), covered by their tests.
const FD_DIR = '/proc/self/fd';
const hasFd = existsSync(FD_DIR);
const fdCount = () => readdirSync(FD_DIR).length;

let tmp = null;
let FH = null;
let orig = null;

const ensure = async () => {
  if (!tmp) tmp = await mkdtemp(join(tmpdir(), 'stream-chain-cleanup-'));
  if (!FH) {
    const probe = await open(join(tmp, 'probe'), 'w');
    FH = Object.getPrototypeOf(probe);
    orig = {read: FH.read, write: FH.write};
    await probe.close();
  }
};

const withPatched = async (patches, fn) => {
  Object.assign(FH, patches);
  try {
    return await fn();
  } finally {
    Object.assign(FH, orig);
  }
};

const settle = v => (v && typeof v.then === 'function' ? v : Promise.resolve(v));

test.asPromise(
  'asyncBlockWriter: a failed final write still releases the FileHandle',
  async (t, resolve) => {
    await ensure();
    if (!hasFd) {
      t.skipTest('fd-leak check requires /proc (Linux)');
      return resolve();
    }
    const sink = asyncBlockWriter(join(tmp, 'w-fail'), {writeBlockSize: 1 << 20});
    await settle(sink('hello')); // buffered; no fd opened yet
    const writeErr = new Error('write boom');
    let caught;
    const before = fdCount();
    await withPatched(
      {
        write() {
          throw writeErr;
        }
      },
      async () => {
        try {
          await settle(sink(none)); // final(): open, write tail (fails), must still close
        } catch (e) {
          caught = e;
        }
      }
    );
    const after = fdCount();
    t.equal(caught, writeErr, 'the write error propagates');
    t.ok(
      after <= before,
      `the handle was released despite the write failure (fds ${before} -> ${after})`
    );
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: a failed block write (data pass) still releases the FileHandle',
  async (t, resolve) => {
    await ensure();
    if (!hasFd) {
      t.skipTest('fd-leak check requires /proc (Linux)');
      return resolve();
    }
    // Small block so the first value fills a block and triggers a real
    // data-pass write (open + write) — the fd is opened DURING the data pass,
    // before any `none`. With write patched to fail, the stage must release the
    // handle on its way out instead of leaking it (final() never runs here).
    const sink = asyncBlockWriter(join(tmp, 'w-fail-datapass'), {writeBlockSize: 4});
    const writeErr = new Error('block write boom');
    let caught;
    const before = fdCount();
    await withPatched(
      {
        write() {
          throw writeErr;
        }
      },
      async () => {
        try {
          await settle(sink('hello')); // fills block -> open + write (fails) -> release
        } catch (e) {
          caught = e;
        }
      }
    );
    const after = fdCount();
    t.equal(caught, writeErr, 'the block write error propagates');
    t.ok(
      after <= before,
      `the handle was released despite the data-pass write failure (fds ${before} -> ${after})`
    );
    resolve();
  }
);

test.asPromise(
  'asyncBlockReader: a failed read still releases the FileHandle',
  async (t, resolve) => {
    await ensure();
    if (!hasFd) {
      t.skipTest('fd-leak check requires /proc (Linux)');
      return resolve();
    }
    const path = join(tmp, 'r-fail');
    await writeFile(path, 'some content\n');
    const readErr = new Error('read boom');
    let caught;
    const before = fdCount();
    await withPatched(
      {
        read() {
          throw readErr;
        }
      },
      async () => {
        const gen = asyncBlockReader({readBlockSize: 64})(path);
        try {
          for await (const _ of gen); // drain
        } catch (e) {
          caught = e;
        }
      }
    );
    const after = fdCount();
    t.equal(caught, readErr, 'the read error propagates');
    t.ok(
      after <= before,
      `the handle was released despite the read failure (fds ${before} -> ${after})`
    );
    resolve();
  }
);
