/// <reference types="node" />

import {DuplexOptions} from 'node:stream';
import {TypedDuplex} from '../typed-streams.js';

/**
 * Options for the parser stream based on `DuplexOptions` with some additional properties.
 */
interface ParserOptions extends DuplexOptions {
  /**
   * An optional reviver function suitable for `JSON.parse()`.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
   */
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
  /** Whether to ignore errors silently. It defaults to `false`. */
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
}

/**
 * Returns a JSONL parser as a duplex stream.
 * @param options options for the parser stream (see {@link ParserOptions})
 * @returns a duplex stream
 */
declare function parserStream<T = unknown>(
  options?: ParserOptions
): TypedDuplex<string | Uint8Array, T>;

export default parserStream;
export {parserStream};
