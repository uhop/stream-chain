/// <reference types="node" />

import {Buffer} from 'node:buffer';

/**
 * The JSONL parser output.
 */
interface OutputItem {
  /** The key: a sequential number starting from 0. */
  key: number;
  /** The parsed value. */
  value: unknown;
}

/**
 * The reviver function prototype required by `JSON.parse()`.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
 */
type Reviver = (this: unknown, key: string, value: unknown) => unknown;

/**
 * A function form of `errorIndicator`. Called with the thrown error, the raw
 * input line, and the configured reviver. Its return value replaces the line;
 * returning `undefined` drops the line.
 */
type ErrorIndicatorFn = (error: Error, input: string, reviver?: Reviver) => unknown;

type ParserOptions = {
  /** An optional reviver function for `JSON.parse()`. */
  reviver?: Reviver;
  /** Whether to ignore errors silently. It defaults to `false`. */
  ignoreErrors?: boolean;
  /**
   * Replace a failed-parse line with this value, or with the result of calling
   * it as `(error, input, reviver) => unknown`. Presence-checked: setting
   * `errorIndicator: undefined` is meaningful (drop bad lines). When both
   * `errorIndicator` and `ignoreErrors` are set, `errorIndicator` wins.
   */
  errorIndicator?: unknown | ErrorIndicatorFn;
};

/**
 * The JSONL parser as a streamable generator.
 * @param reviver an optional reviver function (see {@link Reviver}) or an {@link ParserOptions}
 * @returns an asynchronous generator
 * @remark parsers JSON lines items returning them as {@link OutputItem}.
 */
declare function parser(
  reviver?: Reviver | ParserOptions
): (x: string | Buffer) => AsyncGenerator<OutputItem, void, unknown>;

/**
 * The raw per-line parser factory — no `fixUtf8Stream()` / `lines()` front.
 * Returns a function the caller can compose into a pipeline where chunks
 * already arrive as one full JSON line per call.
 */
declare function jsonlParser(
  options?: Reviver | ParserOptions
): (line: string) => OutputItem | typeof import('../defs.js').none;

export default parser;
export {parser, jsonlParser};
