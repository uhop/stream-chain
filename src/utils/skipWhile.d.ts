import {none} from '../defs';

export = skipWhile;

type Fn = (value: unknown) => boolean | Promise<boolean>;

declare function skipWhile(fn: Fn): (value: unknown) => unknown | none;
