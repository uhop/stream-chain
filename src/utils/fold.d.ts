import {none} from '../defs';

export = fold;

declare function fold<A, T>(
  fn: (acc: A, value: T) => A,
  acc: A
): (value: T) => A | typeof none;
declare function fold<A, T>(
  fn: (acc: A, value: T) => Promise<A>,
  acc: A
): (value: T) => Promise<A | typeof none>;
