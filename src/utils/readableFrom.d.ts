/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from '../typed-streams';

export = readableFrom;

type Iter<T> = (() => T) | (() => Promise<T>) | Iterable<T> | AsyncIterable<T>;

interface ReadableFromOptions<T> extends ReadableOptions {
  iterable?: Iter<T>;
}

declare function readableFrom<T>(options: Iter<T> | ReadableFromOptions<T>): TypedReadable<T>;
