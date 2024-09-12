/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';

export = asStream.asStream;

declare namespace AsStream {
  type Fn = (chunk: any, encoding?: string) => unknown;

  declare function asStream<F extends Fn>(
    fn: F,
    options?: DuplexOptions
  ): Duplex<Parameters<F>[0], any>;
}
