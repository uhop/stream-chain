import {none} from '../defs';

export = skip;

declare function skip<T = any>(n: number): (value: T) => T | typeof none;
