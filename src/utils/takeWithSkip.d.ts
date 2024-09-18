import {none, stop} from '../defs';

export = takeWithSkip;

/**
 * Creates a function that takes `n` elements after skipping `skip` elements.
 * @param n number of elements to take
 * @param skip number of elements to skip (defaults to 0)
 * @param finalValue a value that is returned when `n` elements are taken. It can be {@link none} or {@link stop}. It defaults to {@link none}.
 * @returns a function that takes a value and returns a value or {@link finalValue} when `n` elements are taken. It returns {@link none} when `skip` elements are skipped.
 * @remarks This function is more efficient than `skip()` followed by `take()`.
 */
declare function takeWithSkip<T = any>(
  n: number,
  skip?: number,
  finalValue?: typeof none | typeof stop = none
): (value: T) => T | typeof finalValue;
