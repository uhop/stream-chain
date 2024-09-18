/// <reference types="node" />

import {Duplex, DuplexOptions, Readable, Transform, Writable} from 'node:stream';
import {TypedDuplex, TypedReadable, TypedTransform, TypedWritable} from './typed-streams';

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
  type AsFlatList,
  type Fn,
  type OutputType
} from './defs';
import gen from './gen';
import asStream from './asStream';

export = chain;

/**
 * Represents a typed duplex stream as a pair of readable and writable streams.
 */
export type DuplexStream<W = any, R = any> = {
  readable: ReadableStream<R>;
  writable: WritableStream<W>;
};

/**
 * Options for the chain function, which is based on `DuplexOptions`.
 */
export interface ChainOptions extends DuplexOptions {
  /** If `true`, no groupings will be done. Each function will be a separate stream object. */
  noGroupings?: boolean;
  /** If `true`, event bindings to the chain stream object will be skipped. */
  skipEvents?: boolean;
}

/**
 * The tuple type for a chain function with one item.
 */
type ChainSteams1 = [Readable | Writable | Duplex | Transform];
/**
 * The tuple type for a chain function with multiple items.
 */
type ChainSteams = [
  Readable | Duplex | Transform,
  ...(Duplex | Transform)[],
  Writable | Duplex | Transform
];

/**
 * Represents the output of the chain function. It is based on `Duplex` with extra properties.
 */
export interface ChainOutput<W, R> extends Duplex {
  /** Internal list of streams. */
  streams: ChainSteams1 | ChainSteams;
  /** The first stream, which can be used to feed the chain and to attach event handlers. */
  input: Readable | Writable | Duplex | Transform;
  /** The last stream, which can be used to consume results and to attach event handlers. */
  output: Readable | Writable | Duplex | Transform;
}

/**
 * Returns the first argument of a chain, a stream, or a function.
 */
export type Arg0<F> = F extends TypedTransform<infer W, any>
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
    ? any
    : AsFlatList<F> extends readonly (infer F1)[]
    ? Arg0<F1>
    : never
  : F extends (...args: readonly any[]) => unknown
  ? Parameters<F>[0]
  : never;

/**
 * Returns the return type of a chain, a stream, or a function.
 */
export type Ret<F, Default = any> = F extends TypedTransform<any, infer R>
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
  ? F1 extends (null | undefined)
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
  ? F1 extends (null | undefined)
    ? readonly [F1, ...ChainList<I, R>]
    : readonly [ChainItem<I, F1>, ...ChainList<Ret<F1, I>, R>]
  : L;

/**
 * Takes a function or an iterable and returns the underlying function.
 * @param fn function or iterable
 * @returns the underlying function
 * @remarks In the case of a function, it returns the argument. For iterables it returns the function associated with `Symbol.iterator` or `Symbol.asyncIterator`.
 */
declare function dataSource<F>(
  fn: F
): F extends AsyncIterable<infer T>
  ? () => AsyncIterator<T>
  : F extends Iterable<infer T>
  ? () => Iterator<T>
  : F extends Fn
  ? F
  : never;

/**
 * Creates a stream object out of a list of functions and streams.
 * @param fns array of functions, streams, or other arrays
 * @returns a duplex stream with additional properties
 * @remarks This is the main function of this library.
 */
declare function chain<L extends readonly unknown[]>(
  ...fns: ChainList<Arg0<L>, L>
): ChainOutput<Arg0<L>, Ret<L>>;

declare namespace chain {
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
    chain,
    gen,
    asStream,
    dataSource
  };
}
