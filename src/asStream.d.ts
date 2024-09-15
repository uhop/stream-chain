/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';
import {TypedDuplex} from './typed-streams';
import {Arg0, Ret} from './defs';

export = asStream;

declare function asStream<F extends (chunk: any, encoding?: string) => unknown>(
  fn: F,
  options?: DuplexOptions
): TypedDuplex<Arg0<F>, Ret<F>>;
