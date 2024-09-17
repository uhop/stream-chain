import {none, stop} from './defs';

export = takeWhile;

declare function takeWhile<T>(
  fn: (value: T) => boolean,
  finalValue?: typeof none | typeof stop = none
): (value: unknown) => T | typeof finalValue;
declare function takeWhile<T>(
  fn: (value: T) => Promise<boolean>,
  finalValue?: typeof none | typeof stop = none
): (value: unknown) => Promise<T | typeof finalValue>;
