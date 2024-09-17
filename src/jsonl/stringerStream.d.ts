/// <reference types="node" />

import {Transform} from 'node:stream';
import {TypedTransform} from '../typed-streams';

export = stringer;

/**
 * Options for the stringer stream used to control the output.
 */
interface StringerOptions {
  /** The prefix string. It is prepended to the output. Defaults to `""`. */
  prefix?: string;
  /** The suffix string. It is appended to the output. Defaults to `""`. */
  suffix?: string;
  /** The separator string used between items. Defaults to `"\n"`. */
  separator?: string;
  /**
   * The empty value string. It is used when no values were streamed. Defaults to `prefix + suffix`.
   * See {@link StringerOptions.prefix} and {@link StringerOptions.suffix}.
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
}

/**
 * Returns a JSONL stringer as a duplex stream.
 * @param options options for the stringer stream (see {@link StringerOptions})
 * @returns a duplex stream
 */
declare function stringer<T>(options?: any): TypedTransform<T, string>;
