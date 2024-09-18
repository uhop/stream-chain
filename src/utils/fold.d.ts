import {none} from '../defs';

export = fold;

/**
 * Folds values into an accumulator. Returns the accumulator when the source is exhausted.
 * @param fn function that takes an accumulator and a value and returns an accumulator
 * @param acc initial accumulator
 * @returns a function that takes a value and returns an accumulator or {@link none}.
 * @remarks It is modelled on the [reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) method.
 */
declare function fold<A, T>(
  fn: (acc: A, value: T) => A,
  acc: A
): (value: T | typeof none) => A | typeof none;
declare function fold<A, T>(
  fn: (acc: A, value: T) => Promise<A>,
  acc: A
): (value: T | typeof none) => Promise<A | typeof none>;
