/// <reference types="node" />

import {Writable, WritableOptions} from 'stream';
import {TypedWritable} from '../typed-streams';

export = reduceStream;

/** A reducer function prototype */
type Reducer<A, T> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => A;
/** An asynchronous reducer function prototype */
type ReducerPromise<A, T> = (this: ReduceStreamOutput<A, T>, acc: A, value: T) => Promise<A>;

/**
 * Options for the `reduceStream` function based on `WritableOptions` with some additional properties.
 */
interface ReduceStreamOptions<A, T> extends WritableOptions {
  /** A reducer function. */
  reducer?: Reducer<A, T> | ReducerPromise<A, T>;
  /** An initial accumulator. */
  initial?: A;
}

/**
 * A writable stream that contains an accumulator as a property.
 */
interface ReduceStreamOutput<A, T> extends TypedWritable<T> {
  accumulator: A;
}

/**
 * Creates a writable stream that contains an accumulator as a property.
 * @param options options for the reduceStream (see {@link ReduceStreamOptions})
 * @returns a writable stream
 * @remarks It is modelled on the [reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) method.
 */
declare function reduceStream<A, T>(
  options: ReduceStreamOptions<A, T>
): ReduceStreamOutput<A, T>;
/**
 * Creates a writable stream that contains an accumulator as a property.
 * @param reducer a reducer function
 * @param initial an initial accumulator
 * @returns a writable stream
 * @remarks It is modelled on the [reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) method.
 */
declare function reduceStream<A, T>(
  reducer: Reducer<A, T> | ReducerPromise<A, T>,
  initial: A
): ReduceStreamOutput<A, T>;
