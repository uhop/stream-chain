import {none} from '../defs';

export = fold;

type FnArg = (acc: unknown, value: unknown) => unknown;

type FoldOutput = (value: unknown) => unknown | none;

declare function fold(fn: FnArg, acc: unknown): FoldOutput;
