import {none} from '../defs';

export = skip;

declare function skip(n: number): (value: unknown) => unknown | none;
