// @ts-self-types="./asyncBlockWriter.d.ts"

// Async block-writing sink stage (flushable). As the last stage in a
// `gen([…])` pipeline, accepts string-producing predecessor output,
// accumulates it into an in-memory buffer, and writes whole `blockSize`-sized
// blocks to the target path via a `FileHandle`. The flushable's `final()`
// (signaled by passing `none` through the pipe) writes any remaining buffer
// tail and closes the handle — so on a clean pass the file is closed via the
// explicit flush. Use `pipe(...)` to drive a chain so the flush runs after the
// data pass and the file terminates cleanly without user ceremony.
//
// Both I/O branches guard their OWN operations: if a block write (data pass) or
// the tail write (final) fails, the handle is released on the way out before
// the error propagates, so this stage never leaks its own fd. An UNRELATED stage
// throwing elsewhere or an early break reaches it as the flushable's abort,
// `close()`, which `gen()`, `asStream`, and `asWebStream` call on teardown (a
// `stop` upstream flushes it instead);
// a caller driving the stage some other way calls `close()` itself. After a
// failure or `close()` every later call fails too: reopening would truncate what
// was written.
//
// Node-only (uses `node:fs/promises`).

import {open} from 'node:fs/promises';
import {flushable, none} from '../defs.js';

const DEFAULT_WRITE_BLOCK = 1 << 20; // 1 MB

const asyncBlockWriter = (path, options) => {
  const blockSize = options?.writeBlockSize ?? DEFAULT_WRITE_BLOCK;
  let fh = null;
  let buf = '';
  let queue = Promise.resolve();
  let failure = null;
  let closed = false;

  const ensureOpen = async () => {
    if (!fh) fh = await open(path, 'w');
  };

  const checkUsable = () => {
    if (failure) throw new Error('asyncBlockWriter: an earlier write failed', {cause: failure});
    if (closed) throw new Error('asyncBlockWriter: closed');
  };

  const fail = error => {
    failure = error;
    throw error;
  };

  // overlapping calls run one at a time in call order: a second open(path, 'w')
  // truncates the file, and concurrent writes on one FileHandle are unsafe
  const serialize = op => {
    const result = queue.then(op);
    queue = result.catch(() => {});
    return result;
  };

  // release, not finalize: the buffered tail is dropped, an in-flight write settles first;
  // also the stage's abort, which pipeline owners call on abnormal termination
  const close = () => {
    closed = true;
    buf = '';
    return serialize(async () => {
      const f = fh;
      fh = null;
      if (f) await f.close();
    });
  };

  const writer = flushable(
    value => {
      checkUsable();
      if (typeof value !== 'string' || !value) return none;
      buf += value;
      if (buf.length < blockSize) return none;
      // Each filesystem write encodes independently, so keep a surrogate pair together.
      const last = buf.charCodeAt(buf.length - 1);
      const end = last >= 0xd800 && last <= 0xdbff ? buf.length - 1 : buf.length;
      const data = buf.slice(0, end);
      buf = buf.slice(end);
      if (!data) return none;
      return serialize(async () => {
        checkUsable();
        try {
          await ensureOpen();
          await fh.write(data);
        } catch (e) {
          // Our own block write (or open) failed mid-pass — release the handle
          // on the way out so a failed write never leaks the fd, then surface
          // the original error. If the close fails too, keep both errors in
          // order (write, close). Mirrors final()'s cleanup below.
          const f = fh;
          fh = null;
          if (f) {
            try {
              await f.close();
            } catch (closeErr) {
              fail(
                new AggregateError(
                  [e, closeErr],
                  'asyncBlockWriter: block write and close both failed'
                )
              );
            }
          }
          fail(e);
        }
        return none;
      });
    },
    () =>
      serialize(async () => {
        checkUsable();
        let pending,
          failed = false;
        try {
          await ensureOpen(); // also creates an empty file when there is no tail
          if (buf.length) {
            const data = buf;
            buf = '';
            await fh.write(data);
          }
        } catch (e) {
          pending = e;
          failed = true;
        }
        // Always release the handle, even if the final write failed — never leak
        // it. If the close fails too, keep both errors in order (write, close).
        const f = fh;
        fh = null;
        if (f) {
          try {
            await f.close();
          } catch (closeErr) {
            fail(
              failed
                ? new AggregateError(
                    [pending, closeErr],
                    'asyncBlockWriter: final write and close both failed'
                  )
                : closeErr
            );
          }
        }
        if (failed) fail(pending);
        return none;
      }),
    close
  );

  return Object.assign(writer, {close});
};

export default asyncBlockWriter;
export {asyncBlockWriter};
