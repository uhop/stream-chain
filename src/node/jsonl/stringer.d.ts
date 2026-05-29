/// <reference types="node" />

import {Transform, TransformOptions} from 'node:stream';
import type {StringerOptions} from '../../jsonl/stringerStream.js';
import type {StringerWebStreamOptions} from '../../jsonl/stringerWebStream.js';

/**
 * Node-flavored JSONL stringer entry. The factory returns a Node `Transform`
 * (objects in, JSONL text out); `stringer.asStream` is the factory itself and
 * `stringer.asWebStream(options)` returns the Web `TransformStream`.
 */
declare function stringer(options?: stringer.JsonlStringerOptions): Transform;

declare namespace stringer {
  /** Options for the JSONL stringer. Extends Node.js `TransformOptions`. */
  export interface JsonlStringerOptions extends StringerOptions, TransformOptions {}
  /** The JSONL stringer as a Node `Transform`. */
  export function asStream(options?: JsonlStringerOptions): Transform;
  /** The JSONL stringer as a Web `TransformStream`. */
  export function asWebStream(options?: StringerWebStreamOptions): TransformStream;
}

type JsonlStringerOptions = stringer.JsonlStringerOptions;

export default stringer;
export {stringer, stringer as jsonlStringer};
export type {JsonlStringerOptions};
