import {none} from './defs';

export = takeWhile;

type Fn = (value: unknown) => boolean | Promise<boolean>;

declare function takeWhile(fn: Fn, finalValue?: unknown): (value: unknown) => unknown | none;
