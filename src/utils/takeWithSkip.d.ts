import {none, stop} from '../defs';

export = takeWithSkip;

declare function takeWithSkip<T = unknown>(
  n: number,
  skip?: number,
  finalValue?: typeof none | typeof stop = none
): (value: T) => T | typeof finalValue;
