/// <reference types="node" />

import {Duplex, DuplexOptions} from 'node:stream';

export = parserStream;

interface ParserOptions extends DuplexOptions {
  reviver?: (this: unknown, key: string, value: unknown) => unknown;
}

declare function parserStream(options: ParserOptions): Duplex;
