/**
 * Result of a single `next()` call. Mirrors the iterator-result protocol
 * (`{value, done}`) and exactly matches `ReadableStreamDefaultReader.read()`'s
 * resolved value.
 *
 * @typeParam T — the value type carried by the puller.
 */
export interface WebPullResult<T> {
  /** The next chunk from the stream, or `undefined` if `done` is `true`. */
  value: T | undefined;
  /** `true` once the source stream has ended; `false` while values are still flowing. */
  done: boolean;
}

/**
 * Awaitable handle over a Web Streams `ReadableStream`. Use `next()` to
 * pull one item at a time, `close()` to release the reader lock without
 * canceling the underlying stream, or `cancel(reason)` to cancel the
 * stream (which the caller can't do directly while the puller holds the
 * lock).
 *
 * @typeParam T — the value type of the underlying stream's chunks.
 */
export interface WebStreamPuller<T> {
  /**
   * Pull the next chunk from the stream.
   *
   * Resolves with `{value, done: false}` while values are flowing, or
   * `{value: undefined, done: true}` once the stream closes. Rejects with
   * the stream's error reason if the stream errors.
   *
   * After `close()` or `cancel()`, returns `{value: undefined, done: true}`
   * immediately.
   */
  next(): Promise<WebPullResult<T>>;

  /**
   * Release the reader lock on the underlying stream without canceling it.
   * Idempotent.
   */
  close(): void;

  /**
   * Cancel the underlying stream (releases the lock as a side effect).
   * Idempotent — second call resolves to `undefined`.
   *
   * @param reason — propagated to the stream's `cancel()` algorithm.
   * @returns a Promise that resolves when the stream's cancel completes.
   */
  cancel(reason?: unknown): Promise<unknown>;
}

/**
 * Wraps a Web Streams `ReadableStream` as an awaitable item source.
 *
 * @typeParam T — the value type of the underlying stream's chunks.
 * @param stream — the `ReadableStream` to wrap. A reader is acquired
 *   immediately (locking the stream); call `puller.close()` to release the
 *   lock, or `puller.cancel(reason)` to cancel and release.
 * @returns a `WebStreamPuller<T>` exposing `next()`, `close()`, and `cancel()`.
 */
declare function makeWebStreamPuller<T = unknown>(
  stream: ReadableStream<T>
): WebStreamPuller<T>;

export default makeWebStreamPuller;
export {makeWebStreamPuller};
