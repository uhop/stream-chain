// @ts-self-types="./asyncBlockReader.d.ts"

// Async block-reading source generator. As the first stage in a `gen([…])`
// pipeline, accepts a path string, opens the file, reads `blockSize`-sized
// raw blocks via `fileHandle.read`, decodes each through `StringDecoder('utf8')`
// (which buffers any split multi-byte sequence across blocks), and yields the
// decoded strings one block at a time. The file handle is closed in `finally`
// so it's released even if the consumer aborts mid-iteration.
//
// Node-only (uses `node:fs/promises` + `node:string_decoder`).

import {open} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import {StringDecoder} from 'node:string_decoder';

const DEFAULT_READ_BLOCK = 65536; // 64 KB

const asyncBlockReader = options => {
  const blockSize = options?.readBlockSize ?? DEFAULT_READ_BLOCK;
  return async function* (path) {
    const fh = await open(path);
    let pending,
      failed = false;
    try {
      const sd = new StringDecoder('utf8');
      const buf = Buffer.allocUnsafe(blockSize);
      for (;;) {
        const {bytesRead} = await fh.read(buf, 0, blockSize);
        if (!bytesRead) break;
        const s = sd.write(buf.subarray(0, bytesRead));
        if (s) yield s;
      }
      const tail = sd.end();
      if (tail) yield tail;
    } catch (e) {
      pending = e;
      failed = true;
    } finally {
      // Always close the handle; if the close fails too, keep both errors in
      // order (read, close) instead of letting the close mask the original.
      try {
        await fh.close();
      } catch (closeErr) {
        throw failed
          ? new AggregateError([pending, closeErr], 'asyncBlockReader: read and close both failed')
          : closeErr;
      }
    }
    if (failed) throw pending;
  };
};

export default asyncBlockReader;
export {asyncBlockReader};
