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
// the error propagates, so this stage never leaks its own fd. (It cannot,
// however, observe an UNRELATED stage throwing elsewhere in the pipe — the
// stage simply stops being called; that is the caller's to handle.)
//
// Node-only (uses `node:fs/promises`).

import {open} from 'node:fs/promises';
import {flushable, none} from '../defs.js';

const DEFAULT_WRITE_BLOCK = 1 << 20; // 1 MB

const asyncBlockWriter = (path, options) => {
  const blockSize = options?.writeBlockSize ?? DEFAULT_WRITE_BLOCK;
  let fh = null;
  let buf = '';

  const ensureOpen = async () => {
    if (!fh) fh = await open(path, 'w');
  };

  return flushable(
    value => {
      if (typeof value !== 'string' || !value) return none;
      buf += value;
      if (buf.length < blockSize) return none;
      const data = buf;
      buf = '';
      return (async () => {
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
              throw new AggregateError(
                [e, closeErr],
                'asyncBlockWriter: block write and close both failed'
              );
            }
          }
          throw e;
        }
        return none;
      })();
    },
    async () => {
      let pending,
        failed = false;
      try {
        await ensureOpen(); // also creates an empty file when there is no tail
        if (buf.length) {
          await fh.write(buf);
          buf = '';
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
          throw failed
            ? new AggregateError(
                [pending, closeErr],
                'asyncBlockWriter: final write and close both failed'
              )
            : closeErr;
        }
      }
      if (failed) throw pending;
      return none;
    }
  );
};

export default asyncBlockWriter;
export {asyncBlockWriter};
