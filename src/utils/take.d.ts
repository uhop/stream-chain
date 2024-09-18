import {none, stop} from '../defs';

export = take;

/**
 * Creates a function that takes `n` elements.
 * @param n number of elements
 * @param finalValue a value that is returned when `n` elements are taken. It can be {@link none} or {@link stop}. It defaults to {@link none}.
 * @returns a function that takes a value and returns a value or {@link finalValue} when `n` elements are taken
 */
declare function take<T = any>(
  n: number,
  finalValue?: typeof none | typeof stop = none
): (value: T) => T | typeof finalValue;
