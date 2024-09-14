/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';

export = asStream;

declare function asStream<F extends (chunk: any, encoding?: string) => unknown>(
  fn: F,
  options?: DuplexOptions
): Duplex;
