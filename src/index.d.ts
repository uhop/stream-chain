/// <reference types="node" />

import {Duplex, DuplexOptions, Readable, Transform, Writable} from 'node:stream';
import {TypedDuplex, TypedReadable, TypedTransform, TypedWritable} from './typed-streams.js';

import {
  none,
  stop,
  Stop,
  finalSymbol,
  finalValue,
  final,
  isFinalValue,
  getFinalValue,
  manySymbol,
  many,
  isMany,
  getManyValues,
  getFunctionList,
  flushSymbol,
  flushable,
  isFlushable,
  fListSymbol,
  isFunctionList,
  setFunctionList,
  clearFunctionList,
  batchedSymbol,
  batched,
  isBatched,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut,
  type AsFlatList,
  type Fn,
  type OutputType
} from './defs.js';
import gen from './gen.js';
import asStream from './asStream.js';
import asWebStream from './asWebStream.js';

/**
 * Creates a stream object out of a list of functions and streams.
 * @param fns array of functions, streams, or arrays (flattened recursively). Falsy items are ignored.
 * @param options optional `Duplex` options plus `{noGrouping?, skipEvents?}`. See {@link ChainOptions}. Defaults to `{writableObjectMode: true, readableObjectMode: true}`.
 * @returns a `Duplex` stream extended with `.streams`, `.input`, and `.output` properties.
 * @remarks This is the main function of this library.
 */
declare function chain<L extends readonly unknown[]>(
  fns: chain.ChainList<chain.Arg0<L>, L>,
  options?: chain.ChainOptions
): chain.ChainOutput<chain.Arg0<L>, chain.Ret<L>>;

/**
 * Same as {@link chain} but bypasses TypeScript type checking on `fns`. Use when
 * you need an escape hatch for inputs the strict signature can't express.
 * @param fns array of functions, streams, or nested arrays (flattened recursively). Type checking is intentionally not applied.
 * @param options optional `Duplex` options plus `{noGrouping?, skipEvents?}`. See {@link ChainOptions}.
 * @returns a `Duplex` stream extended with `.streams`, `.input`, and `.output` properties, typed as `ChainOutput<W, R>` (caller-supplied type parameters).
 */
declare function chainUnchecked<W = any, R = any>(
  fns: readonly any[],
  options?: chain.ChainOptions
): chain.ChainOutput<W, R>;

declare namespace chain {
  /**
   * Represents a typed duplex stream as a pair of readable and writable streams.
   */
  export type DuplexStream<W = unknown, R = unknown> = {
    readable: ReadableStream<R>;
    writable: WritableStream<W>;
  };

  /**
   * Options for the chain function, which is based on `DuplexOptions`.
   */
  export interface ChainOptions extends DuplexOptions {
    /** If `true`, no groupings will be done. Each function will be a separate stream object. */
    noGrouping?: boolean;
    /** If `true`, event bindings to the chain stream object will be skipped. */
    skipEvents?: boolean;
    /**
     * Transport batch size for internal boundaries. A function section coalesces
     * its drain into one `many()` chunk per `batch` items when the next stage is
     * a `batched()` stream. Defaults to `1000`; `<= 1` disables batching (the
     * per-item path). Invisible to downstream functions — they still see items.
     */
    batch?: number;
    /**
     * If `true`, also batch the chain's own output (the trailing function
     * section emits `many()` chunks to whoever reads the chain). The consumer
     * must iterate `many()` arrays. No-op unless the last stage is a function
     * section. Off by default so a per-item consumer isn't handed `many()`.
     */
    batchOutput?: boolean;
  }

  /**
   * The tuple type for a chain function with one item.
   */
  type ChainStreams1 = [Readable | Writable | Duplex | Transform];
  /**
   * The tuple type for a chain function with multiple items.
   */
  type ChainStreams = [
    Readable | Duplex | Transform,
    ...(Duplex | Transform)[],
    Writable | Duplex | Transform
  ];

  /**
   * Read-side overrides added on top of `Duplex` for chain outputs.
   * Notes on what's NOT here:
   *   - `write`/`end` are not narrowed to `W` because doing so breaks structural
   *     compatibility with `NodeJS.WritableStream` (which fixes `chunk: string | Uint8Array`
   *     for non-objectMode streams) and consequently breaks `readable.pipe(chain)`.
   *     `W` rides via the phantom `__streamTypeW` (mirroring `TypedDuplex`) so
   *     `Arg0<ChainOutput<W, R>>` recovers `W` for chain-of-chain inference.
   */
  interface ChainOutputExtensions<W, R> {
    /** Phantom carrier for the writable-side type. Type-only — never callable at runtime. */
    __streamTypeW(): W;
    /** Phantom carrier for the readable-side type. Type-only — never callable at runtime. */
    __streamTypeR(): R;

    /** Internal list of streams. */
    streams: ChainStreams1 | ChainStreams;
    /** The first stream, which can be used to feed the chain and to attach event handlers. */
    input: Readable | Writable | Duplex | Transform;
    /** The last stream, which can be used to consume results and to attach event handlers. */
    output: Readable | Writable | Duplex | Transform;

    [Symbol.asyncIterator](): NodeJS.AsyncIterator<R>;

    read(size?: number): R;
    push(chunk: R | null, encoding?: BufferEncoding): boolean;

    on(event: 'data', listener: (chunk: R) => void): this;
    once(event: 'data', listener: (chunk: R) => void): this;
    addListener(event: 'data', listener: (chunk: R) => void): this;
    off(event: 'data', listener: (chunk: R) => void): this;
    removeListener(event: 'data', listener: (chunk: R) => void): this;
    emit(event: 'data', chunk: R): boolean;
  }

  /**
   * Represents the output of the chain function. It is based on `Duplex` with extra properties.
   * `Omit` strips the `any`-returning read/push/asyncIterator members so the R-typed
   * overrides in `ChainOutputExtensions` win; the remaining `Duplex` members (including
   * the typed event-emitter overloads and `write`/`end`/`pipe` compatibility) survive via
   * intersection. `W` rides via the `__streamTypeW` phantom in `ChainOutputExtensions`
   * so `Arg0`/`Ret` can recover both type parameters when a chain output appears inside
   * another chain.
   */
  export type ChainOutput<W, R> = Omit<Duplex, 'read' | 'push' | typeof Symbol.asyncIterator> &
    ChainOutputExtensions<W, R>;

  /**
   * Returns the first argument of a chain, a stream, or a function.
   */
  export type Arg0<F> =
    F extends ChainOutput<infer W, any>
      ? W
      : F extends TypedTransform<infer W, any>
        ? W
        : F extends TypedDuplex<infer W, any>
          ? W
          : F extends TypedReadable<any>
            ? never
            : F extends TypedWritable<infer W>
              ? W
              : F extends Writable | Transform | Duplex
                ? any
                : F extends Readable
                  ? never
                  : F extends TransformStream<infer W, any>
                    ? W
                    : F extends DuplexStream<infer W, any>
                      ? W
                      : F extends WritableStream<infer W>
                        ? W
                        : F extends ReadableStream<any>
                          ? never
                          : F extends readonly unknown[]
                            ? AsFlatList<F> extends readonly [infer F1, ...(readonly unknown[])]
                              ? Arg0<F1>
                              : AsFlatList<F> extends readonly []
                                ? unknown
                                : AsFlatList<F> extends readonly (infer F1)[]
                                  ? Arg0<F1>
                                  : never
                            : F extends (...args: readonly any[]) => unknown
                              ? Parameters<F>[0]
                              : never;

  /**
   * Returns the return type of a chain, a stream, or a function.
   */
  export type Ret<F, Default = unknown> =
    F extends ChainOutput<any, infer R>
      ? R
      : F extends TypedTransform<any, infer R>
        ? R
        : F extends TypedDuplex<any, infer R>
          ? R
          : F extends TypedReadable<infer R>
            ? R
            : F extends TypedWritable<any>
              ? never
              : F extends Readable | Transform | Duplex
                ? any
                : F extends Writable
                  ? never
                  : F extends TransformStream<any, infer R>
                    ? R
                    : F extends DuplexStream<any, infer R>
                      ? R
                      : F extends ReadableStream<infer R>
                        ? R
                        : F extends WritableStream<any>
                          ? never
                          : F extends readonly unknown[]
                            ? AsFlatList<F> extends readonly [...unknown[], infer F1]
                              ? Ret<F1, Default>
                              : AsFlatList<F> extends readonly []
                                ? Default
                                : AsFlatList<F> extends readonly (infer F1)[]
                                  ? Ret<F1, Default>
                                  : never
                            : F extends Fn
                              ? OutputType<F>
                              : never;

  /**
   * Represents an item in the chain function.
   * It is used to highlight mismatches between argument types and return types in a list.
   */
  export type ChainItem<I, F> =
    F extends TypedTransform<infer W, infer R>
      ? I extends W
        ? F
        : TypedTransform<I, R>
      : F extends TypedDuplex<infer W, infer R>
        ? I extends W
          ? F
          : TypedDuplex<I, R>
        : F extends TypedReadable<any>
          ? [I] extends [never]
            ? F
            : never
          : F extends TypedWritable<infer W>
            ? I extends W
              ? F
              : TypedWritable<I>
            : F extends Writable | Transform | Duplex
              ? F
              : F extends Readable
                ? [I] extends [never]
                  ? F
                  : never
                : F extends TransformStream<infer W, infer R>
                  ? I extends W
                    ? F
                    : TransformStream<I, R>
                  : F extends DuplexStream<infer W, infer R>
                    ? I extends W
                      ? F
                      : DuplexStream<I, R>
                    : F extends ReadableStream<any>
                      ? [I] extends [never]
                        ? F
                        : never
                      : F extends WritableStream<infer W>
                        ? I extends W
                          ? F
                          : WritableStream<I>
                        : F extends readonly [infer F1, ...infer R]
                          ? F1 extends null | undefined
                            ? readonly [F1, ...ChainList<I, R>]
                            : readonly [ChainItem<I, F1>, ...ChainList<Ret<F1, I>, R>]
                          : F extends readonly unknown[]
                            ? readonly [ChainItem<I, any>]
                            : F extends Fn
                              ? I extends Arg0<F>
                                ? F
                                : (arg: I, ...rest: readonly unknown[]) => ReturnType<F>
                              : never;

  /**
   * Replicates a tuple verifying the types of the list items so arguments match returns.
   * The replicated tuple is used to highlight mismatches between list items.
   */
  export type ChainList<I, L> = L extends readonly [infer F1, ...infer R]
    ? F1 extends null | undefined
      ? readonly [F1, ...ChainList<I, R>]
      : readonly [ChainItem<I, F1>, ...ChainList<Ret<F1, I>, R>]
    : L;
}

export default chain;
export {chain, chainUnchecked, gen, asStream, asWebStream};
export {dataSource} from './dataSource.js';
export {
  none,
  stop,
  Stop,
  finalSymbol,
  finalValue,
  final,
  isFinalValue,
  getFinalValue,
  manySymbol,
  many,
  isMany,
  getManyValues,
  getFunctionList,
  flushSymbol,
  flushable,
  isFlushable,
  fListSymbol,
  isFunctionList,
  setFunctionList,
  clearFunctionList,
  batchedSymbol,
  batched,
  isBatched,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut
};
