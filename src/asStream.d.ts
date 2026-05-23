/// <reference types="node" />

import {DuplexOptions} from 'node:stream';
import {TypedDuplex} from './typed-streams.js';
import {Arg0, Ret} from './defs.js';

/** Options for {@link asStream}: Duplex options plus transport batching. */
export interface AsStreamOptions extends DuplexOptions {
  /**
   * Coalesce terminal items into one `many()` chunk per `batch` items (with a
   * final partial flush). `<= 1` or unset keeps the per-item path. The
   * downstream stage must consume `many()` (another section, or a `batched()`
   * stream) — chain() sets this only at boundaries it knows are safe.
   */
  batch?: number;
}

/**
 * Wraps a function in a duplex stream
 * @param fn function to wrap
 * @param options options for the wrapping duplex stream
 * @returns a duplex stream
 */
declare function asStream<F extends (chunk: any, encoding?: string) => unknown>(
  fn: F,
  options?: AsStreamOptions
): TypedDuplex<Arg0<F>, Ret<F>>;

export default asStream;
export {asStream};
