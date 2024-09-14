/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';

export = readableFrom;

type Iter<T = unknown> = (() => T) | (() => Promise<T>) | Iterable<T> | AsyncIterable<T>;

interface ReadableFromOptions<T = unknown> extends ReadableOptions {
  iterable?: Iter<T>;
}

declare function readableFrom<T>(options: Iter<T> | ReadableFromOptions<T>): Readable;
