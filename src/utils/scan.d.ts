export = scan;

/**
 * Creates a function that scans values into an accumulator.
 * @param fn a function that takes an accumulator and a value and returns an accumulator
 * @param acc an initial accumulator
 * @returns a function that takes a value and returns an accumulator
 * @remarks It is a companion for `fold()`. Unlike `fold()` it returns the current accumulator for each value.
 */
declare function scan<A, T>(fn: (acc: A, value: T) => A, acc: A): (value: T) => A;
declare function scan<A, T>(
  fn: (acc: A, value: T) => Promise<A>,
  acc: A
): (value: T) => Promise<A>;
