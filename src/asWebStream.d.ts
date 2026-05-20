/**
 * Wraps a function as a Web Streams `TransformStream`. Dual role mirroring `asStream`:
 *   - Pass a Web Streams object (Readable/Writable/duplex pair) → returned as-is.
 *   - Pass a function → returns a `TransformStream` that runs the function per chunk.
 *
 * Implementation is a structural clone of `asStream` — full-blown executor with a
 * fast path for `gen(...)` / `fun(...)` function-list compositions (inline loop into
 * `controller.enqueue`), and a slow path with pump/queue/sanitize for promises,
 * generators, many, finalValue, and stop. Backpressure is handled by TransformStream's
 * internal queue.
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
