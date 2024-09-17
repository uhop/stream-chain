import {none} from '../defs';

export = batch;

type BatchOutput<T> = (value: T) => (T[] | typeof none);

declare function batch<T = any>(n?: number): BatchOutput<T>;
