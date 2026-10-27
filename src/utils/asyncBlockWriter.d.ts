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
 * @remarks After a failed write (or close) every later call, the flush included,
 *   throws an `Error` whose `cause` is the original failure; the file is never reopened.
 */
declare function asyncBlockWriter(
  path: string,
  options?: AsyncBlockWriterOptions
): AsyncBlockWriter;

/** The sink stage returned by `asyncBlockWriter()`. */
interface AsyncBlockWriter {
  (value: string): unknown;
  /**
   * Releases the file handle without writing the buffered tail, after any
   * write in flight settles. Also the stage's flushable `abort`: `gen()`, `asStream()`,
   * and `asWebStream()` call it when a pipeline ends without a flush (an error in
   * another stage, an early break). Call it yourself when driving the stage some other
   * way. Idempotent, and a no-op after a clean flush; every later call to the stage throws.
   */
  close(): Promise<void>;
}

export default asyncBlockWriter;
export {asyncBlockWriter};
export type {AsyncBlockWriter, AsyncBlockWriterOptions};
