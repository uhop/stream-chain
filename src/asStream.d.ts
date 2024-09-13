/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';
import type {OutputType} from './defs';

export = asStream;

export interface TypedDuplex<I, O> extends Duplex {}

declare function asStream<F extends (chunk: any, encoding?: string) => unknown>(
  fn: F,
  options?: DuplexOptions
): TypedDuplex<Parameters<F>[0], OutputType<F>>;
