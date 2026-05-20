import type {Arg0, Ret} from '../defs.js';

export interface CoreChainOptions {}

/**
 * The /core chain output: a callable async-iterable factory.
 * Calling it with an iterable yields each value through the composed function pipeline.
 *
 * Property surface (`streams` / `input` / `output`) is intentionally `null` here for
 * parity with `/node`'s `ChainOutput` and `/web`'s `ChainWebStream` — same property
 * names, substrate-specific values (or `null` when there's no substrate).
 */
export interface CoreChainOutput<W, R> {
  (input?: AsyncIterable<W> | Iterable<W>): AsyncGenerator<R, void, unknown>;
  readonly streams: null;
  readonly input: null;
  readonly output: null;
}

/**
 * Creates a function-list-driven chain that runs purely on async iteration —
 * no Node streams, no Web Streams. Browser-safe.
 *
 * Only `fun(...)` / `gen(...)` operators (and plain functions) are accepted; passing
 * `asStream(...)` or `asWebStream(...)` items is unsupported in `/core`.
 *
 * @param fns array of functions, `fun(...)` wrappers, `gen(...)` wrappers, or nested arrays
 * @returns a callable async-iterable factory with null stream-shape statics
 */
declare function chain<const L extends readonly unknown[]>(
  fns: L,
  options?: CoreChainOptions
): CoreChainOutput<Arg0<L>, Ret<L>>;

declare function chainUnchecked<W = any, R = any>(
  fns: readonly any[],
  options?: CoreChainOptions
): CoreChainOutput<W, R>;

export default chain;
export {chain, chainUnchecked};
export {gen} from '../gen.js';
export {fun} from '../fun.js';
export * from '../defs.js';
