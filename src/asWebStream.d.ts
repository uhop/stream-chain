/**
 * Options for `asWebStream`. Uses Web Streams' standard `QueuingStrategy`
 * (the same `{highWaterMark, size}` shape accepted by `new ReadableStream` /
 * `new WritableStream` constructors).
 *
 * - `strategy`: shorthand applied to both readable and writable sides when no
 *   side-specific strategy is given.
 * - `readableStrategy` / `writableStrategy`: per-side strategy; overrides `strategy`.
 *
 * Defaults (when nothing passed): Web Streams' built-in `{highWaterMark: 1}`
 * for object queues.
 *
 * See [[highWaterMark]] for what hwm means and how it affects perf.
 */
export interface AsWebStreamOptions<W = unknown, R = unknown> {
  /** Queuing strategy applied to both sides if no side-specific strategy is given. */
  strategy?: QueuingStrategy;
  /** Queuing strategy for the readable side. Overrides `strategy`. */
  readableStrategy?: QueuingStrategy<R>;
  /** Queuing strategy for the writable side. Overrides `strategy`. */
  writableStrategy?: QueuingStrategy<W>;
}

/**
 * Wraps a function as a Web Streams duplex pair (`{readable, writable}`).
 * Dual role mirroring `asStream`:
 *   - Pass a Web Streams object (Readable/Writable/duplex pair) → returned as-is.
 *   - Pass a function → returns a duplex pair that runs the function per chunk.
 *
 * Implementation is a structural clone of `asStream` — full-blown executor with
 * a fast path for `gen(...)` / `fun(...)` function-list compositions, and a slow
 * path with pump/queue/sanitize for promises, generators, many, finalValue, and
 * stop. Proper per-item backpressure: when `controller.desiredSize <= 0` after
 * an enqueue, the next push returns a Promise that resolves on `pull()` —
 * mirroring `asStream`'s pause/resume pattern. Queue stays at hwm.
 *
 * Returns `{readable, writable}` (a Web Streams duplex pair), NOT a
 * `TransformStream`.
 */
/**
 * Pass-through overload: a `ReadableStream` is returned as-is.
 * @param input a Web Streams `ReadableStream`.
 * @returns the same `ReadableStream` unchanged.
 */
declare function asWebStream<R>(input: ReadableStream<R>): ReadableStream<R>;
/**
 * Pass-through overload: a `WritableStream` is returned as-is.
 * @param input a Web Streams `WritableStream`.
 * @returns the same `WritableStream` unchanged.
 */
declare function asWebStream<W>(input: WritableStream<W>): WritableStream<W>;
/**
 * Pass-through overload: a duplex pair `{readable, writable}` is returned as-is.
 * @param input a Web Streams duplex pair.
 * @returns the same duplex pair unchanged.
 */
declare function asWebStream<W, R>(
  input: {readable: ReadableStream<R>; writable: WritableStream<W>}
): {readable: ReadableStream<R>; writable: WritableStream<W>};
/**
 * Wraps a function as a Web Streams `{readable, writable}` duplex pair.
 * @param input the function to wrap. Regular, async, generator, or async generator. May return any value type including `none`/`stop`/`many(...)`/`finalValue(...)`.
 * @param options optional `{strategy?, readableStrategy?, writableStrategy?}` Web Streams `QueuingStrategy` configuration. `strategy` is shorthand for both sides; per-side wins. Defaults to Web Streams' built-in `{highWaterMark: 1}` on each side.
 * @returns a Web Streams duplex pair `{readable: ReadableStream<R>, writable: WritableStream<W>}` with per-item backpressure.
 */
declare function asWebStream<W = unknown, R = unknown>(
  input: (chunk: W) => R | Promise<R> | Iterator<R> | AsyncIterator<R>,
  options?: AsWebStreamOptions<W, R>
): {readable: ReadableStream<R>; writable: WritableStream<W>};

export default asWebStream;
export {asWebStream};

export declare function isReadableWebStream(x: unknown): x is ReadableStream;
export declare function isWritableWebStream(x: unknown): x is WritableStream;
export declare function isDuplexWebStream(
  x: unknown
): x is {readable: ReadableStream; writable: WritableStream};
