/// <reference types="node" />

import {Writable, WritableOptions} from 'stream';
import {TypedWritable} from '../typed-streams';

export = reduceStream;

type Reducer<A, T> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => A;
type ReducerPromise<A, T> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => Promise<A>;

interface ReduceStreamOptions<A, T> extends WritableOptions {
  reducer?: Reducer<A, T> | ReducerPromise<A, T>;
  initial?: A;
}

interface ReduceStreamOutput<A, T> extends TypedWritable<T> {
  accumulator: A;
}

declare function reduceStream<A, T>(
  options: ReduceStreamOptions<A, T>
): ReduceStreamOutput<A, T>;
declare function reduceStream<A, T>(
  reducer: Reducer<A, T> | ReducerPromise<A, T>,
  initial: A
): ReduceStreamOutput<A, T>;
