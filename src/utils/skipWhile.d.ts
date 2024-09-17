import {none} from '../defs';

export = skipWhile;

declare function skipWhile<T>(fn: (value: T) => boolean): (value: T) => T | typeof none;
declare function skipWhile<T>(
  fn: (value: T) => Promise<boolean>
): (value: T) => Promise<T | typeof none>;
