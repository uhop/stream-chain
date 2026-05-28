interface AsyncBlockReaderOptions {
  /** Block size in bytes for `fileHandle.read()`. Defaults to 64 KB. */
  readBlockSize?: number;
}

/**
 * Async block-reading source generator factory. Returns a function that, given
 * a path, opens the file and yields decoded UTF-8 string blocks of up to
 * `readBlockSize` bytes (multi-byte sequences split across blocks are buffered
 * via `StringDecoder`). The file handle is closed when iteration completes or
 * the consumer aborts.
 */
declare function asyncBlockReader(
  options?: AsyncBlockReaderOptions
): (path: string) => AsyncGenerator<string, void, unknown>;

export default asyncBlockReader;
export {asyncBlockReader};
