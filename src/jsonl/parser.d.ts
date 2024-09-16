/// <reference types="node" />

import {Buffer} from 'node:buffer';

export = parser;

interface OutputItem {
  key: number;
  value: any;
}

type Reviver = (this: unknown, key: string, value: unknown) => unknown;

declare function parser(
  reviver?: Reviver
): (x: string | Buffer) => AsyncGenerator<OutputItem, void, unknown>;
