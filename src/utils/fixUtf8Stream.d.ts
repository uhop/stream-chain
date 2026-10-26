import {none} from '../defs.js';

/**
 * Converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 */
type FixOutput = (chunk: string | Uint8Array | typeof none) => string;

/** Options for `fixUtf8Stream()`. */
interface FixUtf8StreamOptions {
  /**
   * Keep a byte-order mark (U+FEFF) that starts the input, as `TextDecoder`'s
   * `ignoreBOM` does. Defaults to `false`: the BOM is dropped, whether the stream
   * carries bytes or strings. A U+FEFF later in the stream is always kept.
   */
  ignoreBOM?: boolean;
}

/**
 * Creates a function that converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 * @param options optional settings (see {@link FixUtf8StreamOptions})
 * @returns a converter function
 * @remarks A stream should carry either bytes or strings, not both: string chunks pass through
 *   unchanged, ahead of any partial character the decoder still holds from an earlier byte chunk.
 */
declare function fixUtf8Stream(options?: FixUtf8StreamOptions): FixOutput;

/**
 * Resolves when the optional Node-side fast-path (StringDecoder) is loaded,
 * or immediately on non-Node runtimes. Calling this is optional — fixUtf8Stream()
 * always works; awaiting whenReady() before composition just ensures the
 * fastest available implementation is captured.
 */
declare function whenReady(): Promise<void>;

export default fixUtf8Stream;
export {fixUtf8Stream, whenReady};
export type {FixUtf8StreamOptions};
