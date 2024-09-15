/// <reference types="node" />

import {Writable, WritableOptions} from 'stream';
import {TypedWritable} from '../typed-streams';

export = reduceStream;

type Reducer<A = unknown, T = A> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => A;
type ReducerPromise<A = unknown, T = A> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => Promise<A>;

interface ReduceStreamOptions<A = unknown, T = A> extends WritableOptions {
  reducer?: Reducer<A, T> | ReducerPromise<A, T>;
  initial?: A;
}

interface ReduceStreamOutput<A = unknown, T = A> extends TypedWritable<T, A> {
  accumulator: A;
}

declare function reduceStream<A = unknown, T = A>(
  options: ReduceStreamOptions<A, T>
): ReduceStreamOutput<A, T>;
declare function reduceStream<A = unknown, T = A>(
  reducer: Reducer<A, T> | ReducerPromise<A, T>,
  initial: A
): ReduceStreamOutput<A, T>;
