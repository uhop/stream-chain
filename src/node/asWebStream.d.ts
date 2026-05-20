/// <reference types="node" />

import type {Duplex, Readable, Writable} from 'node:stream';

/**
 * Materialize a Node stream (typically a /node chain output) as a Web Streams object.
 * Wraps Node 22+ `Duplex.toWeb()` / `Readable.toWeb()` / `Writable.toWeb()`.
 */
declare function asWebStream<W, R>(
  stream: Duplex
): {readable: ReadableStream<R>; writable: WritableStream<W>};
declare function asWebStream<R>(stream: Readable): ReadableStream<R>;
declare function asWebStream<W>(stream: Writable): WritableStream<W>;

export default asWebStream;
export {asWebStream};
