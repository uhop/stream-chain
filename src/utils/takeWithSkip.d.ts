import {none} from '../defs';

export = takeWithSkip;

declare function takeWithSkip(
  n: number,
  skip?: number,
  finalValue?: unknown
): (value: unknown) => unknown | none;
