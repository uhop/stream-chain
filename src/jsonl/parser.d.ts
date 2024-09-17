/// <reference types="node" />

import {Buffer} from 'node:buffer';

export = parser;

/**
 * The JSONL parser output.
 */
interface OutputItem {
  /** The key: a sequential number starting from 0. */
  key: number;
  /** The parsed value. */
  value: any;
}

/**
 * The reviver function prototype required by `JSON.parse()`.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
 */
type Reviver = (this: unknown, key: string, value: unknown) => unknown;

/**
 * The JSONL parser as a streamable generator.
 * @param reviver an optional reviver function (see {@link Reviver})
 * @returns an asynchronous generator
 * @remark parsers JSON lines items returning them as {@link OutputItem}.
 */
declare function parser(
  reviver?: Reviver
): (x: string | Buffer) => AsyncGenerator<OutputItem, void, unknown>;
