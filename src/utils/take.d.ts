import {none, stop} from '../defs';

export = take;

declare function take<T = unknown>(
  n: number,
  finalValue?: typeof none | typeof stop = none
): (value: T) => T | typeof finalValue;
