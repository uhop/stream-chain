/// <reference types="node" />

import { Writable, WritableOptions } from "stream";

export = reduceStream;

type Reducer = (this: ReduceStreamOutput, acc: unknown, value: unknown) => unknown;

interface ReduceStreamOptions extends WritableOptions {
  reducer?: Reducer;
  initial?: unknown;
}

interface ReduceStreamOutput extends Writable {
  accumulator: unknown;
}

declare function reduceStream(options: ReduceStreamOptions): ReduceStreamOutput;
declare function reduceStream(reducer: Reducer, initial: unknown): ReduceStreamOutput;
