// @ts-self-types="./asyncBlockWriter.d.ts"

// Async block-writing sink stage (flushable). As the last stage in a
// `gen([…])` pipeline, accepts string-producing predecessor output,
// accumulates it into an in-memory buffer, and writes whole `blockSize`-sized
// blocks to the target path via a `FileHandle`. The flushable's `final()`
// (signaled by passing `none` through the pipe) writes any remaining buffer
// tail and closes the handle — so the file is closed only via the explicit
// flush. Use `pipe(...)` to drive a chain so the flush runs after the data
// pass and the file terminates cleanly without user ceremony.
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
        await ensureOpen();
        await fh.write(data);
        return none;
      })();
    },
    async () => {
      if (buf.length) {
        await ensureOpen();
        await fh.write(buf);
        buf = '';
      } else {
        await ensureOpen(); // ensure an empty file is created
      }
      const f = fh;
      fh = null;
      await f.close();
      return none;
    }
  );
};

export default asyncBlockWriter;
export {asyncBlockWriter};
