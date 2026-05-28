/**
 * Options for the parser Web Stream.
 */
interface ParserWebStreamOptions {
  /**
   * An optional reviver function suitable for `JSON.parse()`.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
   */
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
  /** Whether to ignore parse errors silently. Defaults to `false`. */
  ignoreErrors?: boolean;
  /**
   * Replace a failed-parse line with this value, or with the result of calling
   * it as `(error, input, reviver) => unknown`. Presence-checked: setting
   * `errorIndicator: undefined` is meaningful (drop bad lines). When both
   * `errorIndicator` and `ignoreErrors` are set, `errorIndicator` wins.
   */
  errorIndicator?:
    | unknown
    | ((
        error: Error,
        input: string,
        reviver?: (this: unknown, key: string, value: unknown) => unknown
      ) => unknown);
  /** Queuing strategy applied to both sides if no side-specific strategy is given. */
  strategy?: QueuingStrategy;
  /** Queuing strategy for the readable side. Overrides `strategy`. */
  readableStrategy?: QueuingStrategy;
  /** Queuing strategy for the writable side. Overrides `strategy`. */
  writableStrategy?: QueuingStrategy;
}

/**
 * Returns a JSONL parser as a Web Streams duplex pair (`{readable, writable}`).
 * Counterpart to `parserStream` (Node Duplex via `asStream`) for the Web Streams
 * substrate — same `parser()` core, wrapped via `asWebStream`.
 *
 * Each emitted value is `{key, value}` where `key` is the zero-based line index
 * and `value` is the parsed object (or `undefined` if `ignoreErrors: true` and
 * the line was unparseable).
 *
 * @param options options for the parser (see {@link ParserWebStreamOptions}).
 * @returns a Web Streams duplex pair `{readable, writable}`.
 */
declare function parserWebStream<T = unknown>(
  options?: ParserWebStreamOptions
): {
  readable: ReadableStream<{key: number; value: T}>;
  writable: WritableStream<string | Uint8Array>;
};

export default parserWebStream;
export {parserWebStream};
