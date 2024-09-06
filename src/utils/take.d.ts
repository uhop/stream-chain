import {none} from '../defs';

export = take;

declare function take(n: number, finalValue?: unknown): (value: unknown) => unknown | none;
