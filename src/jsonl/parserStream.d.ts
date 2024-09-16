/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';
import {TypedDuplex} from '../typed-streams';

export = parserStream;

interface ParserOptions extends DuplexOptions {
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
}

declare function parserStream<T = any>(
  options?: ParserOptions
): TypedDuplex<string | Uint8Array, T>;
