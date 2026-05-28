/**
 * Options for the JSONL stringer.
 */
interface StringerOptions {
  /** Prepended to the output. Defaults to `""`. */
  prefix?: string;
  /** Appended to the output. Defaults to `""`. */
  suffix?: string;
  /** Between items. Defaults to `"\n"`. */
  separator?: string;
  /** Used when no values were streamed. Defaults to `prefix + suffix`. */
  emptyValue?: string;
  /**
   * Replacer for `JSON.stringify()`.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
   */
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  /** Space argument for `JSON.stringify()`. */
  space?: string | number;
}

/**
 * Function-shaped JSONL stringer suitable for composition in a `gen([…])`
 * pipeline. Returns a flushable that emits string fragments per input value
 * and the terminal suffix on flush.
 */
declare function stringer<T = unknown>(options?: StringerOptions): (value: T) => unknown;

export default stringer;
export {stringer};
