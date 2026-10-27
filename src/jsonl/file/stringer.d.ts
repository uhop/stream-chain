interface StringerToFileOptions {
  /** Buffered block size in characters before issuing a `fileHandle.write()`. Defaults to 1 MB. */
  writeBlockSize?: number;
  /** Prepended to the output. Defaults to `""`. */
  prefix?: string;
  /** Appended to the output. Defaults to `""`. */
  suffix?: string;
  /** Between items. Defaults to `"\n"`. */
  separator?: string;
  /** Used when no values were streamed. Defaults to `prefix + suffix`. */
  emptyValue?: string;
  /** Replacer for `JSON.stringify()`. */
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  /** Space argument for `JSON.stringify()`. */
  space?: string | number;
}

/**
 * Returns a `gen()` pipeline that, used as the terminal stage of a chain,
 * writes each input value as one JSON-stringified line to `path`. Must be
 * driven via `pipe(...)` so the writer's flushable `final()` closes the file.
 */
declare function stringerToFile<T = unknown>(
  path: string,
  options?: StringerToFileOptions
): StringerToFile<T>;

/** The sink returned by `stringerToFile()`. */
interface StringerToFile<T = unknown> {
  (value: T): AsyncGenerator<never, void, unknown>;
  /**
   * Releases the file handle without writing the buffered tail, after any
   * write in flight settles. The pipeline calls it when it ends without a flush (an
   * error in another stage, an early break); call it yourself when driving the sink
   * some other way. Idempotent, and a no-op after a clean flush; every later call to
   * the sink throws.
   */
  close(): Promise<void>;
}

export default stringerToFile;
export {stringerToFile, stringerToFile as stringer};
export type {StringerToFile, StringerToFileOptions};
