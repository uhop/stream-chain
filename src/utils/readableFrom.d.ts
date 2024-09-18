/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from '../typed-streams';

export = readableFrom;

/**
 * A function or an iterable that will be used as a data source.
 */
type Iter<T> = (() => T) | (() => Promise<T>) | Iterable<T> | AsyncIterable<T>;

/**
 * Options for the `readableFrom` function based on `ReadableOptions` with some additional properties.
 */
interface ReadableFromOptions<T> extends ReadableOptions {
  /** An iterable or a function that will be used as a data source. */
  iterable?: Iter<T>;
}

/**
 * Creates a readable stream from an iterable or a function that will be used as a data source.
 * @param options readable options (see {@link ReadableFromOptions}) or an iterable or a function that will be used as a data source.
 * @returns a readable stream
 */
declare function readableFrom<T>(options: Iter<T> | ReadableFromOptions<T>): TypedReadable<T>;
