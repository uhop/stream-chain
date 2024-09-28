/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';
import {TypedDuplex} from '../typed-streams';

export = parserStream;

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
}

/**
 * Returns a JSONL parser as a duplex stream.
 * @param options options for the parser stream (see {@link ParserOptions})
 * @returns a duplex stream
 */
declare function parserStream<T = any>(
  options?: ParserOptions
): TypedDuplex<string | Uint8Array, T>;
