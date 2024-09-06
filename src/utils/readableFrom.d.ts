/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';

export = readableFrom;

type Iter = (() => unknown) | Iterable<unknown> | AsyncIterable<unknown>;

interface ReadableFromOptions extends ReadableOptions {
  iterable?: Iter;
}

declare function readableFrom(options: Iter | ReadableFromOptions): Readable;
