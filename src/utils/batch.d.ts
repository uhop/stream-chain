import {none} from '../defs';

export = batch;

type BatchOutput<T = unknown> = (value: T) => (T[] | none);

declare function batch<T = unknown>(n?: number): BatchOutput<T>;
