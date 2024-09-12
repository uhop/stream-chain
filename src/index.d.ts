/// <reference types="node" />

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
  setFunctionList
} from './defs';
import gen, {type Fn, type Iter} from './gen';
import asStream from './asStream';
import {Duplex, DuplexOptions, Readable, Transform, Writable} from 'node:stream';

export = chain;

type DuplexStream = {readable: ReadableStream; writable: WritableStream};

type ChainType1<Self> = [
  | Fn
  | Iter
  | Readable
  | Writable
  | Duplex
  | Transform
  | ReadableStream
  | WritableStream
  | DuplexStream
  | Self[]
];
interface Chain1 extends ChainType1<Chain1> {}

type ChainType<Self> = [
  Fn | Iter | Readable | Duplex | Transform | ReadableStream | DuplexStream | Self[],
  ...(Fn | Iter | Duplex | Transform | DuplexStream | Self[])[],
  Fn | Iter | Writable | Duplex | Transform | WritableStream | DuplexStream | Self[]
];
interface Chain extends ChainType<Chain> {}

interface ChainOptions extends DuplexOptions {
  noGroupings?: boolean;
  skipEvents?: boolean;
}

type ChainSteams1 = [Readable | Writable | Duplex | Transform];
type ChainSteams = [
  Readable | Duplex | Transform,
  ...(Duplex | Transform)[],
  Writable | Duplex | Transform
];

interface ChainOutput extends Duplex {
  streams: ChainSteams1 | ChainSteams;
  input: Readable | Writable | Duplex | Transform;
  output: Readable | Writable | Duplex | Transform;
}

declare function chain(fns: Chain1 | Chain, options?: ChainOptions): ChainOutput;

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

declare function dataSource(fn: Fn | Iter): Fn;
