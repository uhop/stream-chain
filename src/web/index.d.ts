import type {Arg0, Ret} from '../defs.js';

export interface ChainWebStreamOptions {}

/**
 * A single stage in a /web chain: has a readable side, a writable side, or both.
 * Source stages have `writable: null`; sink stages have `readable: null`.
 */
export interface ChainWebStage {
  readonly readable: ReadableStream | null;
  readonly writable: WritableStream | null;
}

/**
 * The /web chain output: a Web Streams duplex pair plus parity statics.
 *
 * Property surface parity with /node's `ChainOutput` and /core's `CoreChainOutput`:
 *   - `streams`: the array of internal stages
 *   - `input`: the first stage
 *   - `output`: the last stage
 *
 * Pipe through other Web Streams via `chain([...]).readable.pipeThrough(other)`.
 * NOT structurally a `TransformStream` — chains are many-in/many-out with
 * independent backpressure profiles that `TransformStream`'s per-chunk
 * `transform()` model doesn't fit cleanly.
 */
export interface ChainWebStream<W, R> {
  readonly readable: ReadableStream<R> | null;
  readonly writable: WritableStream<W> | null;
  readonly streams: ReadonlyArray<ChainWebStage>;
  readonly input: ChainWebStage;
  readonly output: ChainWebStage;
  __streamTypeW(): W;
  __streamTypeR(): R;
}

declare function chain<const L extends readonly unknown[]>(
  fns: L,
  options?: ChainWebStreamOptions
): ChainWebStream<Arg0<L>, Ret<L>>;

declare function chainUnchecked<W = any, R = any>(
  fns: readonly any[],
  options?: ChainWebStreamOptions
): ChainWebStream<W, R>;

export default chain;
export {chain, chainUnchecked};
export {default as gen} from '../gen.js';
export {default as fun} from '../fun.js';
export {default as asWebStream} from '../asWebStream.js';
export {
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream
} from '../asWebStream.js';
export * from '../defs.js';
