/**
 * Wraps a function as a Web Streams duplex pair (`{readable, writable}`).
 * Dual role mirroring `asStream`:
 *   - Pass a Web Streams object (Readable/Writable/duplex pair) → returned as-is.
 *   - Pass a function → returns a duplex pair that runs the function per chunk.
 *
 * Implementation is a structural clone of `asStream` — full-blown executor with
 * a fast path for `gen(...)` / `fun(...)` function-list compositions, and a slow
 * path with pump/queue/sanitize for promises, generators, many, finalValue, and
 * stop. Proper backpressure: the underlying ReadableStream's `pull()` callback
 * fires when the consumer wants more; writes that fill the queue
 * (`controller.desiredSize <= 0`) return a Promise that resolves on `pull()`,
 * throttling the upstream — same shape as `asStream`'s pause/resume pattern.
 *
 * Returns `{readable, writable}` (a Web Streams duplex pair), NOT a
 * `TransformStream` — TransformStream's per-chunk `transform()` callback can't
 * suspend mid-call to wait for consumer drain.
 */
declare function asWebStream<R>(input: ReadableStream<R>): ReadableStream<R>;
declare function asWebStream<W>(input: WritableStream<W>): WritableStream<W>;
declare function asWebStream<W, R>(
  input: {readable: ReadableStream<R>; writable: WritableStream<W>}
): {readable: ReadableStream<R>; writable: WritableStream<W>};
declare function asWebStream<W = unknown, R = unknown>(
  input: (chunk: W) => R | Promise<R> | Iterator<R> | AsyncIterator<R>
): {readable: ReadableStream<R>; writable: WritableStream<W>};

export default asWebStream;
export {asWebStream};

export declare function isReadableWebStream(x: unknown): x is ReadableStream;
export declare function isWritableWebStream(x: unknown): x is WritableStream;
export declare function isDuplexWebStream(
  x: unknown
): x is {readable: ReadableStream; writable: WritableStream};
