import {none} from '../defs';

export = batch;

type BatchOutput = (value: unknown) => (unknown[] | none);

declare function batch(n?: number): BatchOutput;
