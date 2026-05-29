import type {ParserWebStreamOptions} from '../../jsonl/parserWebStream.js';

/**
 * Web-flavored JSONL parser entry. Browser-safe — the returned factory parses a
 * JSON-Lines stream into `{key, value}` items in a `chain()` pipeline and carries
 * `parser.asWebStream(options)` (Web `{readable, writable}` pair). No `.asStream`
 * (that would pull in `node:stream`).
 */
declare function parser<T = unknown>(
  options?: parser.JsonlParserOptions
): (x: string | Uint8Array) => AsyncGenerator<parser.JsonlItem<T>, void, unknown>;

declare namespace parser {
  /** Options for the JSONL parser, including Web Streams queuing strategies. */
  export interface JsonlParserOptions extends ParserWebStreamOptions {
    /**
     * Accepted for stream-json compatibility; **no-op** — the default path
     * already surfaces parse errors by throwing. Use `errorIndicator` /
     * `ignoreErrors` to change error handling.
     */
    checkErrors?: boolean;
  }
  /** An item emitted by the JSONL parser: a sequential index and its parsed value. */
  export interface JsonlItem<T = unknown> {
    /** Zero-based line index. */
    key: number;
    /** The parsed value, typed as `T` (default `unknown`). */
    value: T;
  }
  /** The JSONL parser wrapped as a Web Streams `{readable, writable}` pair. */
  export function asWebStream(options?: JsonlParserOptions): {
    readable: ReadableStream;
    writable: WritableStream;
  };
}

type JsonlParserOptions = parser.JsonlParserOptions;
type JsonlItem<T = unknown> = parser.JsonlItem<T>;

/**
 * The raw per-line parser factory (no `fixUtf8Stream` / `lines` input front),
 * re-exported from the pure core for advanced composition.
 */
declare const jsonlParser: typeof import('../../jsonl/parser.js').jsonlParser;

export default parser;
export {parser, jsonlParser};
export type {JsonlParserOptions, JsonlItem};
