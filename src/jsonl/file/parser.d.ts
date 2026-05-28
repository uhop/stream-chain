interface ParseFileOptions {
  /** Block size in bytes for the file reader. Defaults to 64 KB. */
  readBlockSize?: number;
  /** Reviver for `JSON.parse()`. */
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
  /** Drop bad lines silently. Counter still bumps (gappy keys). */
  ignoreErrors?: boolean;
  /**
   * Replace a failed-parse line with this value, or with the result of calling
   * it as `(error, input, reviver) => unknown`. Presence-checked.
   */
  errorIndicator?: unknown;
}

interface ParserOutput {
  key: number;
  value: unknown;
}

/**
 * Returns a `gen()` pipeline that, given a file path, opens the file, reads
 * it in blocks, and emits parsed `{key, value}` records per line.
 */
declare function parseFile(
  options?: ParseFileOptions
): (path: string) => AsyncGenerator<ParserOutput, void, unknown>;

export default parseFile;
export {parseFile, parseFile as parser};
export type {ParseFileOptions, ParserOutput};
