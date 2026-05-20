import {none} from '../defs.js';

/**
 * The flushable function that outputs text in lines.
 */
type LinesOutput = (value: string | typeof none) => Generator<string, void, unknown>;

/**
 * Creates a flushable function that outputs text in lines.
 * @returns a splitter function
 */
declare function lines(): LinesOutput;

export default lines;
export {lines};
