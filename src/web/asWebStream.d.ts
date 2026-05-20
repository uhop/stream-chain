/**
 * Wraps a function or Web Streams object as a Web Streams chain step.
 * Dual role mirroring 3.x `asStream`:
 *   - Pass a Web Streams object (Readable/Writable/duplex pair) → returned as-is.
 *   - Pass a function → returns a `TransformStream` that runs the function per chunk
 *     via gen() dispatch (full Many/None/Stop/Final/flushable support).
 */
declare function asWebStream<R>(input: ReadableStream<R>): ReadableStream<R>;
declare function asWebStream<W>(input: WritableStream<W>): WritableStream<W>;
declare function asWebStream<W, R>(
  input: {readable: ReadableStream<R>; writable: WritableStream<W>}
): {readable: ReadableStream<R>; writable: WritableStream<W>};
declare function asWebStream<W = unknown, R = unknown>(
  input: (chunk: W) => R | Promise<R> | Iterator<R> | AsyncIterator<R>
): TransformStream<W, R>;

export default asWebStream;
export {asWebStream};

export declare function isReadableWebStream(x: unknown): x is ReadableStream;
export declare function isWritableWebStream(x: unknown): x is WritableStream;
export declare function isDuplexWebStream(
  x: unknown
): x is {readable: ReadableStream; writable: WritableStream};
