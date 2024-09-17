import {none, stop} from '../defs';

export = takeWithSkip;

declare function takeWithSkip<T = any>(
  n: number,
  skip?: number,
  finalValue?: typeof none | typeof stop = none
): (value: T) => T | typeof finalValue;
