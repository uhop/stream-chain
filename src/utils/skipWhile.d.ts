import {none} from '../defs';

export = skipWhile;

/**
 * Creates a function that skips values while `fn` returns `true`.
 * @param fn a function that takes a value and returns a boolean
 * @returns a function that takes a value and returns a value or {@link none} when skipping
 */
declare function skipWhile<T>(fn: (value: T) => boolean): (value: T) => T | typeof none;
declare function skipWhile<T>(
  fn: (value: T) => Promise<boolean>
): (value: T) => Promise<T | typeof none>;
