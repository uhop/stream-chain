/**
 * A function or an iterable that will be used as a data source.
 */
type Iter<T> = (() => T) | (() => Promise<T>) | Iterable<T> | AsyncIterable<T>;

/**
 * Options for the `readableWebStreamFrom` function.
 */
interface ReadableWebStreamFromOptions<T> {
  /** An iterable or a function that will be used as a data source. */
  iterable?: Iter<T>;
  /** Optional Web Streams `QueuingStrategy` (`{highWaterMark, size}`) applied to the readable side. */
  strategy?: QueuingStrategy<T>;
}

/**
 * Creates a Web Streams `ReadableStream` from an iterable, iterator, or function.
 *
 * Mirrors `readableFrom` (which returns a Node `Readable`) for the Web Streams
 * substrate. Accepts the same input shapes — a plain iterable, an async
 * iterable, a sync/async iterator, or a 0-ary function (sync or async) returning
 * a value, generator, or async generator. Recognizes stream-chain's special
 * markers in the producer's output (`none`, `stop`, `many(...)`); a returned
 * `finalValue(...)` is unwrapped to its underlying value (no rest-of-chain skip,
 * since this is a source).
 *
 * Per-item backpressure: when the readable's `desiredSize` drops to 0 after an
 * enqueue, the pump parks on a promise that resolves on the next `pull()`.
 *
 * @param options an iterable, function, or `{iterable, strategy?}` options object.
 * @returns a Web Streams `ReadableStream<T>`.
 */
declare function readableWebStreamFrom<T>(
  options: Iter<T> | ReadableWebStreamFromOptions<T>
): ReadableStream<T>;

export default readableWebStreamFrom;
export {readableWebStreamFrom};
