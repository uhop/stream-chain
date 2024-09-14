import {none, stop} from '../defs';

export = fold;

declare function fold<A = unknown, T = A>(
  fn: (acc: A, value: T) => A,
  acc: A
): (value: T) => A | none;
declare function fold<A = unknown, T = A>(
  fn: (acc: A, value: T) => Promise<A>,
  acc: A
): (value: T) => Promise<A | none>;
