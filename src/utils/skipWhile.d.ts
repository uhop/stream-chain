import {none} from '../defs';

export = skipWhile;

declare function skipWhile<T = unknown>(fn: (value: T) => boolean): (value: T) => T | none;
declare function skipWhile<T = unknown>(
  fn: (value: T) => Promise<boolean>
): (value: T) => Promise<T | none>;
