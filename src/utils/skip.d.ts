import {none} from '../defs';

export = skip;

/**
 * Creates a function that skips `n` elements.
 * @param n number of elements to skip
 * @returns a function that takes a value and returns a value or {@link none} when skipping
 */
declare function skip<T = any>(n: number): (value: T) => T | typeof none;
