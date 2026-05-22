/**
 * Options for the stringer Web Stream used to control the output.
 */
interface StringerWebStreamOptions {
  /** The prefix string. It is prepended to the output. Defaults to `""`. */
  prefix?: string;
  /** The suffix string. It is appended to the output. Defaults to `""`. */
  suffix?: string;
  /** The separator string used between items. Defaults to `"\n"`. */
  separator?: string;
  /**
   * The empty value string. It is used when no values were streamed. Defaults to `prefix + suffix`.
   * See {@link StringerWebStreamOptions.prefix} and {@link StringerWebStreamOptions.suffix}.
   */
  emptyValue?: string;
  /**
   * The optional replacer function used by `JSON.stringify()`.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
   */
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  /**
   * The optional space string or number used by `JSON.stringify()`.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
   */
  space?: string | number;
  /** Optional Web Streams `QueuingStrategy` for the writable side. */
  writableStrategy?: QueuingStrategy<unknown>;
  /** Optional Web Streams `QueuingStrategy` for the readable side. */
  readableStrategy?: QueuingStrategy<string>;
}

/**
 * Returns a JSONL stringer as a Web Streams `TransformStream` (objects in,
 * concatenated JSON strings out). Counterpart to `stringerStream` for the Web
 * Streams substrate.
 *
 * The transform stage is fully synchronous (`JSON.stringify` is sync), so a
 * `TransformStream` is the natural shape — no per-item backpressure machinery
 * is needed beyond what the platform provides. Closing the writable side
 * triggers `flush`, which emits the `suffix` (or `emptyValue` / `prefix + suffix`
 * if no values were written).
 *
 * @param options options for the stringer (see {@link StringerWebStreamOptions}).
 * @returns a `TransformStream<T, string>` — usable directly in a `/web` chain.
 */
declare function stringerWebStream<T>(
  options?: StringerWebStreamOptions
): TransformStream<T, string>;

export default stringerWebStream;
export {stringerWebStream};
