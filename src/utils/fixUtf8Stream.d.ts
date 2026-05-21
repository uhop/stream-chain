import {none} from '../defs.js';

/**
 * Converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 */
type FixOutput = (chunk: string | Uint8Array | typeof none) => string;

/**
 * Creates a function that converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 * @returns a converter function
 */
declare function fixUtf8Stream(): FixOutput;

/**
 * Resolves when the optional Node-side fast-path (StringDecoder) is loaded,
 * or immediately on non-Node runtimes. Calling this is optional — fixUtf8Stream()
 * always works; awaiting whenReady() before composition just ensures the
 * fastest available implementation is captured.
 */
declare function whenReady(): Promise<void>;

export default fixUtf8Stream;
export {fixUtf8Stream, whenReady};
