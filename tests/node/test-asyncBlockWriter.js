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

const withFailingWrite = async (failOn, fn) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  const probe = await open(join(dir, 'probe'), 'w');
  const FH = Object.getPrototypeOf(probe),
    write = FH.write;
  await probe.close();
  const boom = new Error('write boom');
  FH.write = function (...args) {
    if (args[0] === failOn) throw boom;
    return write.apply(this, args);
  };
  try {
    await fn(join(dir, 'out.txt'), boom);
  } finally {
    FH.write = write;
    await rm(dir, {recursive: true, force: true});
  }
};

const isRefusal = (error, cause) =>
  error instanceof Error && /an earlier write failed/.test(error.message) && error.cause === cause;

test.asPromise(
  'asyncBlockWriter: a failed write fails the calls queued behind it',
  async (t, resolve) => {
    await withFailingWrite('aaaa', async (path, boom) => {
      const sink = asyncBlockWriter(path, {writeBlockSize: 4});
      const [first, second] = await Promise.allSettled([sink('aaaa'), sink('bbbb')]);
      t.equal(first.status, 'rejected');
      t.equal(first.reason, boom);
      t.equal(second.status, 'rejected');
      t.ok(isRefusal(second.reason, boom), 'refused with the original error as cause');
    });
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: after a failure, later calls are refused and the file is kept',
  async (t, resolve) => {
    await withFailingWrite('bbbb', async (path, boom) => {
      const sink = asyncBlockWriter(path, {writeBlockSize: 4});
      await sink('aaaa');
      let error = null;
      try {
        await sink('bbbb');
      } catch (e) {
        error = e;
      }
      t.equal(error, boom, 'the failed write rejects with its own error');
      t.throws(() => sink('cc'), 'a buffered value is refused');
      try {
        await sink('cccc');
        t.fail('a block write after a failure must be refused');
      } catch (e) {
        t.ok(isRefusal(e, boom), 'block write refused');
      }
      try {
        await sink(none);
        t.fail('the flush after a failure must be refused');
      } catch (e) {
        t.ok(isRefusal(e, boom), 'flush refused');
      }
      t.equal(await readFile(path, 'utf8'), 'aaaa', 'not reopened, not truncated');
    });
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: close() drops the tail and refuses later calls',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    try {
      const path = join(dir, 'out.txt');
      const sink = asyncBlockWriter(path, {writeBlockSize: 4});
      await sink('aaaa');
      await sink('bb');
      await sink.close();
      await sink.close();
      t.equal(await readFile(path, 'utf8'), 'aaaa', 'the buffered tail is dropped');
      t.throws(() => sink('cc'), 'a later value is refused');
      try {
        await sink(none);
        t.fail('a flush after close() must be refused');
      } catch (e) {
        t.ok(/closed/.test(e.message), 'flush refused');
      }
      t.equal(await readFile(path, 'utf8'), 'aaaa', 'not reopened, not truncated');
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

test.asPromise('asyncBlockWriter: close() lets a write in flight finish', async (t, resolve) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  try {
    const path = join(dir, 'out.txt');
    const sink = asyncBlockWriter(path, {writeBlockSize: 4});
    const pending = sink('aaaa');
    await new Promise(r => setImmediate(r)); // the block write has started
    await sink.close();
    t.equal(await pending, none, 'the write in flight completed');
    t.equal(await readFile(path, 'utf8'), 'aaaa');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('asyncBlockWriter: close() after a clean flush is a no-op', async (t, resolve) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  try {
    const path = join(dir, 'out.txt');
    const sink = asyncBlockWriter(path, {writeBlockSize: 4});
    await sink('aaaa');
    await sink('bb');
    await sink(none);
    await sink.close();
    t.equal(await readFile(path, 'utf8'), 'aaaabb');
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

test.asPromise(
  'asyncBlockWriter: Unicode survives fragment and block boundaries',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    const cases = [
      ['abc\uD83D', '\uDE00def'],
      ['\uD83D', '\uDE00'],
      ['é', '😀', '字'],
      ['a\uD83D', '\uDE00\uD83D', '\uDE00z'],
      ['ab\uD83D', '\uD83D', '\uDE00z'],
      ['abc\uD83D', 'x'],
      ['abc\uDE00', 'x'],
      ['abc', '\uD83D']
    ];
    try {
      for (const size of [1, 4, 5]) {
        for (const overlap of [false, true]) {
          for (const [index, chunks] of cases.entries()) {
            const path = join(dir, `${size}-${overlap}-${index}`);
            const sink = asyncBlockWriter(path, {writeBlockSize: size});
            if (overlap) {
              await Promise.all([...chunks.map(chunk => sink(chunk)), sink(none)]);
            } else {
              for (const chunk of chunks) await sink(chunk);
              await sink(none);
            }
            t.deepEqual(
              await readFile(path),
              Buffer.from(chunks.join('')),
              `block size ${size}, overlapping ${overlap}, fragments ${index}`
            );
          }
        }
      }
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

test.asPromise('asyncBlockWriter: close() drops a pending high surrogate', async (t, resolve) => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
  try {
    const path = join(dir, 'out.txt');
    const sink = asyncBlockWriter(path, {writeBlockSize: 4});
    await sink('abc\uD83D');
    await sink.close();
    await sink.close();
    t.equal(await readFile(path, 'utf8'), 'abc');
    t.throws(() => sink('\uDE00'), 'the dropped tail cannot be resumed');
    try {
      await sink(none);
      t.fail('a flush after close() must be refused');
    } catch (e) {
      t.ok(/closed/.test(e.message), 'flush refused');
    }
    t.equal(await readFile(path, 'utf8'), 'abc');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise(
  'asyncBlockWriter: a pending surrogate preserves open-failure refusal',
  async (t, resolve) => {
    const dir = await mkdtemp(join(tmpdir(), 'stream-chain-writer-'));
    try {
      const sink = asyncBlockWriter(join(dir, 'missing', 'out.txt'), {writeBlockSize: 1});
      await sink('\uD83D');
      let error;
      try {
        await sink('\uDE00');
        t.fail('opening a missing parent must fail');
      } catch (e) {
        error = e;
        t.equal(e.code, 'ENOENT');
      }
      t.throws(() => sink('x'), 'later input is refused');
      try {
        await sink(none);
        t.fail('the flush after an open failure must be refused');
      } catch (e) {
        t.ok(isRefusal(e, error), 'the original failure remains the cause');
      }
      await sink.close();
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);
