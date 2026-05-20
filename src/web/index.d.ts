import type {Arg0, Ret} from '../defs.js';

/**
 * Options for `chain(fns, options)` in the `/web` subpath. Uses Web Streams'
 * standard `QueuingStrategy` shape. Forwarded to every `asWebStream` stage the
 * chain creates; existing stream items in `fns` keep their own settings.
 */
export interface ChainWebStreamOptions {
  /** Queuing strategy applied to both sides of each new stage if no side-specific given. */
  strategy?: QueuingStrategy;
  /** Queuing strategy for the readable side of each new stage. */
  readableStrategy?: QueuingStrategy;
  /** Queuing strategy for the writable side of each new stage. */
  writableStrategy?: QueuingStrategy;
}

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

/**
 * `/web` chain factory. Composes functions and Web Streams objects into a
 * native Web Streams duplex pair (no `node:stream` interop). Browser-safe.
 * @param fns array of functions, `gen(...)`/`fun(...)` wrappers, Web Streams objects (`ReadableStream`, `WritableStream`, `{readable, writable}` pairs), or nested arrays (flattened). Falsy items are ignored. Source-only and sink-only streams are allowed at first and last positions respectively.
 * @param options optional `{strategy?, readableStrategy?, writableStrategy?}` Web Streams' `QueuingStrategy` shape. Forwarded to every newly-wrapped `asWebStream` stage; existing stream items keep their own settings.
 * @returns a {@link ChainWebStream} — a `{readable, writable, streams, input, output}` object suitable for piping into / from other Web Streams.
 */
declare function chain<const L extends readonly unknown[]>(
  fns: L,
  options?: ChainWebStreamOptions
): ChainWebStream<Arg0<L>, Ret<L>>;

/**
 * Same as {@link chain} but bypasses TypeScript type checking on `fns`.
 * @param fns array of functions and stream objects. Type checking is intentionally not applied.
 * @param options optional `Web Streams` queuing-strategy options — see {@link ChainWebStreamOptions}.
 * @returns a {@link ChainWebStream} typed as `ChainWebStream<W, R>` (caller-supplied type parameters).
 */
declare function chainUnchecked<W = any, R = any>(
  fns: readonly any[],
  options?: ChainWebStreamOptions
): ChainWebStream<W, R>;

export default chain;
export {chain, chainUnchecked};
export {gen} from '../gen.js';
export {fun} from '../fun.js';
export {asWebStream} from '../asWebStream.js';
export {
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream
} from '../asWebStream.js';
export * from '../defs.js';
