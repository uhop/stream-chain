/// <reference types="node" />

import {Readable} from 'node:stream';

/**
 * Wraps a Node `Readable` as a non-destructive async iterator. Equivalent to
 * `stream.iterator({destroyOnReturn: false})`:
 *
 *   - Original `'error'` value preserved (no `AbortError` wrapping).
 *   - Premature close (`.destroy()` without `'end'` or `'error'`) surfaces as
 *     `Error('Premature close')`.
 *   - Breaking out of `for await` does NOT destroy the source — caller stays
 *     in control of the stream's lifecycle.
 *
 * The returned iterator implements the full async-iterator protocol: `next()`,
 * `return()`, `[Symbol.asyncIterator]()`. Use with `for await (const v of
 * makeStreamPuller(stream))` or by driving `next()` / `return()` directly.
 *
 * @typeParam T — the value type of the underlying stream's chunks. Defaults
 *   to `unknown`.
 * @param stream — the `Readable` to wrap.
 * @returns an async iterator over the stream's chunks.
 */
declare function makeStreamPuller<T = unknown>(stream: Readable): AsyncIterableIterator<T>;

export default makeStreamPuller;
export {makeStreamPuller};
