import {none, stop} from './defs';

export = takeWhile;

/**
 * Creates a function that takes values while `fn` returns `true`.
 * @param fn a function that takes a value and returns a boolean
 * @param finalValue a value that is returned when `fn` returns `false`. It can be {@link none} or {@link stop}. It defaults to {@link none}.
 * @returns a function that takes a value and returns a value or {@link finalValue} when {@link fn} returns `false`
 */
declare function takeWhile<T>(
  fn: (value: T) => boolean,
  finalValue?: typeof none | typeof stop = none
): (value: unknown) => T | typeof finalValue;
declare function takeWhile<T>(
  fn: (value: T) => Promise<boolean>,
  finalValue?: typeof none | typeof stop = none
): (value: unknown) => Promise<T | typeof finalValue>;
