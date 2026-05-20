/**
 * An async iterator over a Web `ReadableStream`'s chunks, with an extra
 * `cancel(reason)` method for cancellation that carries a reason — the
 * standard iterator-protocol `return()` can't convey a cancel reason
 * cleanly.
 *
 * Iteration via `for await` is non-destructive (uses `preventCancel: true`
 * under the hood) — breaking out of the loop releases the reader lock but
 * does NOT cancel the underlying stream.
 *
 * @typeParam T — the value type of the underlying stream's chunks.
 */
export interface WebStreamPuller<T> extends AsyncIterableIterator<T> {
  /**
   * Cancel the underlying stream with a reason (which the source's
   * `cancel` algorithm will receive), then release the reader lock.
   * Calling this after `return()` is a no-op.
   *
   * @param reason — propagated to the stream's `cancel()` algorithm.
   * @returns a Promise that resolves when the stream's cancel completes.
   */
  cancel(reason?: unknown): Promise<unknown>;
}

/**
 * Wraps a Web `ReadableStream` as a non-destructive async iterator with
 * an explicit `cancel(reason)` extension. Equivalent to
 * `stream[Symbol.asyncIterator]({preventCancel: true})` plus the cancel
 * convenience.
 *
 * @typeParam T — the value type of the underlying stream's chunks.
 * @param stream — the `ReadableStream` to wrap. A reader is acquired
 *   immediately (locking the stream); finalize via `for await` exit,
 *   `puller.return()`, or `puller.cancel(reason)`.
 */
declare function makeWebStreamPuller<T = unknown>(
  stream: ReadableStream<T>
): WebStreamPuller<T>;

export default makeWebStreamPuller;
export {makeWebStreamPuller};
