interface AsyncBlockWriterOptions {
  /** Buffered block size in characters before issuing a `fileHandle.write()`. Defaults to 1 MB. */
  writeBlockSize?: number;
}

/**
 * Async block-writing sink stage (flushable). Accepts string values from
 * upstream stages, buffers them, and writes whole `writeBlockSize`-sized
 * blocks to `path` via `fs/promises.open(...).write()`. Closes the file
 * handle on flush (`none` signal). Returns a flushable function-list element
 * suitable for use as the terminal stage of a `gen([…])` pipeline driven
 * with `pipe(...)`.
 */
declare function asyncBlockWriter(
  path: string,
  options?: AsyncBlockWriterOptions
): (value: string) => unknown;

export default asyncBlockWriter;
export {asyncBlockWriter};
