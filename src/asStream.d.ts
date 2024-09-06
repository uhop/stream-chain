/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';

export = asStream;

export type Fn = (chunk: unknown, encoding?: string) => unknown;

declare function asStream(fn: Fn, options?: DuplexOptions): Duplex;
