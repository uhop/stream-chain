import {none} from '../defs';

export = skip;

declare function skip<T = unknown>(n: number): (value: T) => T | none;
