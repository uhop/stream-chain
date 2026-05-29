import type {StringerWebStreamOptions} from '../../jsonl/stringerWebStream.js';

/**
 * Web-flavored JSONL stringer entry. Browser-safe. The factory returns a Web
 * `TransformStream` (objects in, JSONL text out); `stringer.asWebStream` is the
 * factory itself.
 */
declare function stringer(options?: StringerWebStreamOptions): TransformStream;

declare namespace stringer {
  /** The JSONL stringer as a Web `TransformStream`. */
  export function asWebStream(options?: StringerWebStreamOptions): TransformStream;
}

type JsonlStringerOptions = StringerWebStreamOptions;

export default stringer;
export {stringer, stringer as jsonlStringer};
export type {JsonlStringerOptions};
