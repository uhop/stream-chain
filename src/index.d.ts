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
  type Flatten,
  type Fn,
  type OutputType
} from './defs';
import gen from './gen';
import asStream from './asStream';

export = chain;
export {TypedDuplex, TypedReadable, TypedTransform, TypedWritable};

export type DuplexStream<W = any, R = any> = {
  readable: ReadableStream<R>;
  writable: WritableStream<W>;
};

export interface ChainOptions extends DuplexOptions {
  noGroupings?: boolean;
  skipEvents?: boolean;
}

type ChainSteams1 = [Readable | Writable | Duplex | Transform];
type ChainSteams = [
  Readable | Duplex | Transform,
  ...(Duplex | Transform)[],
  Writable | Duplex | Transform
];

export interface ChainOutput<W, R> extends Duplex {
  streams: ChainSteams1 | ChainSteams;
  input: Readable | Writable | Duplex | Transform;
  output: Readable | Writable | Duplex | Transform;
}

export type Arg0<F> =
  F extends TypedTransform<infer W, any>
  ? W
  : F extends TypedDuplex<infer W, any>
  ? W
  : F extends TypedReadable
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
  : F extends ReadableStream
  ? never
  : F extends readonly unknown[]
  ? Flatten<F> extends readonly [infer F1, ...(readonly unknown[])]
    ? Arg0<F1>
    : Flatten<F> extends readonly (infer F1)[]
    ? Arg0<F1>
    : never
  : F extends (...args: readonly any[]) => unknown
  ? Parameters<F>[0]
  : never;

export type Ret<F> =
  F extends TypedTransform<any, infer R>
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
  : F extends WritableStream
  ? never
  : F extends readonly unknown[]
  ? Flatten<F> extends readonly [...unknown[], infer F1]
    ? Ret<F1>
    : never
  : F extends Fn
  ? OutputType<F>
  : never;

export type ChainItem<I, F> =
  F extends TypedTransform<infer W, infer R>
  ? I extends W
    ? F
    : TypedTransform<I, R>
  : F extends TypedDuplex<infer W, infer R>
  ? I extends W
    ? F
    : TypedDuplex<I, R>
  : F extends TypedReadable
  ? I extends never
    ? F
    : never
  : F extends TypedWritable<infer W>
  ? I extends W
    ? F
    : TypedWritable<I>
  : F extends Writable | Transform | Duplex
  ? F
  : F extends Readable
  ? I extends never
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
  : F extends ReadableStream
  ? I extends never
    ? F
    : never
  : F extends WritableStream<infer W>
  ? I extends W
    ? F
    : WritableStream<I>
  : F extends readonly [infer F1, ...infer R]
  ? readonly [ChainItem<I, F1>, ...ChainList<Ret<F1>, R>]
  : F extends readonly unknown[]
  ? readonly [ChainItem<I, any>]
  : F extends Fn
  ? I extends Arg0<F>
    ? F
    : (arg: I, ...rest: readonly unknown[]) => ReturnType<F>
  : never;

export type ChainList<I, L> = L extends readonly [infer F1, ...infer R]
  ? readonly [ChainItem<I, F1>, ...ChainList<Ret<F1>, R>]
  : L;

declare function dataSource<F>(
  fn: F
): F extends AsyncIterable<infer T>
  ? () => AsyncIterator<T>
  : F extends Iterable<infer T>
  ? () => Iterator<T>
  : F extends Fn
  ? F
  : never;

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
    chain,
    gen,
    asStream,
    dataSource
  };
}
