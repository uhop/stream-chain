/// <reference types="node" />

import {none} from '../defs.js';

/**
 * Converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 */
type FixOutput = (chunk: string | Buffer | typeof none) => string;

/**
 * Creates a function that converts buffers to UTF-8 strings and outputs them on the correct character boundaries.
 * @returns a converter function
 */
declare function fixUtf8Stream(): FixOutput;

export default fixUtf8Stream;
export {fixUtf8Stream};
