'use strict';

import test from 'tape-six';

import {open, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline, Readable} from 'node:stream';

import chain from '../../src/index.js';
import asyncBlockReader from '../../src/utils/asyncBlockReader.js';
import asyncBlockWriter from '../../src/utils/asyncBlockWriter.js';
import pipe from '../../src/utils/pipe.js';
import drain from '../../src/utils/drain.js';
import stringerToFile from '../../src/jsonl/file/stringer.js';
import {none, stop} from '../../src/defs.js';

// FileHandle.read/write live on the prototype (patchable); close is an own
// per-instance property (not patchable). So we inject a write/read failure via
// the prototype, capture the handle (`this`) at the failure site, and prove it
// was released before the error propagated: fd === -1 after close (Node, Bun,
// Deno alike). Counting /proc/self/fd was racy under the parallel runner.
// The AggregateError "close also failed" branch shares its combine-logic with
// exec()/pipe(), covered by their tests.

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
    const sink = asyncBlockWriter(join(tmp, 'w-fail'), {writeBlockSize: 1 << 20});
    await settle(sink('hello')); // buffered; no fd opened yet
    const writeErr = new Error('write boom');
    let caught, handle;
    await withPatched(
      {
        write() {
          handle = this;
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
    t.equal(caught, writeErr, 'the write error propagates');
    t.ok(handle, 'the failing write saw the opened FileHandle');
    t.equal(handle?.fd, -1, 'the handle was released despite the write failure');
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: a failed block write (data pass) still releases the FileHandle',
  async (t, resolve) => {
    await ensure();
    // Small block so the first value fills a block and triggers a real
    // data-pass write (open + write) — the fd is opened DURING the data pass,
    // before any `none`. With write patched to fail, the stage must release the
    // handle on its way out instead of leaking it (final() never runs here).
    const sink = asyncBlockWriter(join(tmp, 'w-fail-datapass'), {writeBlockSize: 4});
    const writeErr = new Error('block write boom');
    let caught, handle;
    await withPatched(
      {
        write() {
          handle = this;
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
    t.equal(caught, writeErr, 'the block write error propagates');
    t.ok(handle, 'the failing write saw the opened FileHandle');
    t.equal(handle?.fd, -1, 'the handle was released despite the data-pass write failure');
    resolve();
  }
);

const capturingWrite = onHandle => ({
  write(...args) {
    onHandle(this);
    return orig.write.apply(this, args);
  }
});

test.asPromise('asyncBlockWriter: close() releases the FileHandle', async (t, resolve) => {
  await ensure();
  const sink = asyncBlockWriter(join(tmp, 'w-close'), {writeBlockSize: 4});
  let handle;
  await withPatched(
    capturingWrite(h => (handle = h)),
    () => settle(sink('aaaa')) // fills a block: open + write
  );
  t.ok(handle, 'the block write saw the opened FileHandle');
  t.notEqual(handle?.fd, -1, 'the handle stays open between blocks');
  await sink.close();
  t.equal(handle?.fd, -1, 'close() released the handle');
  resolve();
});

test.asPromise(
  'stringerToFile: close() releases the FileHandle after a failed pipe',
  async (t, resolve) => {
    await ensure();
    const sink = stringerToFile(join(tmp, 's-close'), {writeBlockSize: 4});
    const sourceErr = new Error('source boom');
    let caught, handle;
    await withPatched(
      capturingWrite(h => (handle = h)),
      async () => {
        try {
          await drain(
            pipe(function* (x) {
              yield {a: x};
              throw sourceErr;
            }, sink)(1)
          );
        } catch (e) {
          caught = e;
        } finally {
          await sink.close();
        }
      }
    );
    t.equal(caught, sourceErr, 'the source error propagates');
    t.ok(handle, 'a block write opened the FileHandle');
    t.equal(handle?.fd, -1, 'close() released the handle');
    resolve();
  }
);

test.asPromise(
  'asyncBlockReader: a failed read still releases the FileHandle',
  async (t, resolve) => {
    await ensure();
    const path = join(tmp, 'r-fail');
    await writeFile(path, 'some content\n');
    const readErr = new Error('read boom');
    let caught, handle;
    await withPatched(
      {
        read() {
          handle = this;
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
    t.equal(caught, readErr, 'the read error propagates');
    t.ok(handle, 'the failing read saw the opened FileHandle');
    t.equal(handle?.fd, -1, 'the handle was released despite the read failure');
    resolve();
  }
);

test.asPromise(
  'asyncBlockWriter: a failed pipe releases the FileHandle without close()',
  async (t, resolve) => {
    await ensure();
    const sourceErr = new Error('source boom');
    let caught, handle;
    await withPatched(
      capturingWrite(h => (handle = h)),
      async () => {
        try {
          await drain(
            pipe(
              function* () {
                yield 'aaaa';
                throw sourceErr;
              },
              asyncBlockWriter(join(tmp, 'w-abort'), {writeBlockSize: 4})
            )(0)
          );
        } catch (e) {
          caught = e;
        }
      }
    );
    t.equal(caught, sourceErr, 'the source error propagates');
    t.ok(handle, 'a block write opened the FileHandle');
    t.equal(handle?.fd, -1, 'the teardown released the handle');
    resolve();
  }
);

test.asPromise(
  'stringerToFile: a torn-down chain releases the FileHandle without close()',
  async (t, resolve) => {
    await ensure();
    const sourceErr = new Error('source boom');
    let caught, handle;
    await withPatched(
      capturingWrite(h => (handle = h)),
      () =>
        new Promise(done => {
          const c = chain([
            function* () {
              yield {a: 1};
              throw sourceErr;
            },
            stringerToFile(join(tmp, 's-abort'), {writeBlockSize: 4})
          ]);
          pipeline(Readable.from([0]), c, error => {
            caught = error;
            setTimeout(done, 20);
          });
        })
    );
    t.equal(caught, sourceErr, 'the source error reaches pipeline()');
    t.ok(handle, 'a block write opened the FileHandle');
    t.equal(handle?.fd, -1, 'the teardown released the handle');
    resolve();
  }
);

test.asPromise(
  'stringerToFile: a stop in a web chain still writes the buffered lines',
  async (t, resolve) => {
    await ensure();
    const {chain: webChain} = await import('../../src/web/index.js');
    const {readFile} = await import('node:fs/promises');
    const path = join(tmp, 's-stop');
    const c = webChain([x => (x === 3 ? stop : {n: x}), stringerToFile(path)]);
    const writer = c.writable.getWriter();
    const written = (async () => {
      for (const x of [1, 2, 3, 4]) await writer.write(x).catch(() => {});
      await writer.close().catch(() => {});
    })();
    for await (const _ of c.readable);
    await written;
    t.equal(
      await readFile(path, 'utf8'),
      '{"n":1}\n{"n":2}',
      'the lines before the stop reached the file'
    );
    resolve();
  }
);
