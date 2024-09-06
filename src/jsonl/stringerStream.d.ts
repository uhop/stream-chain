/// <reference types="node" />

import { Transform } from "node:stream";

export = stringer;

interface StringerOptions {
  prefix?: string;
  suffix?: string;
  separator?: string;
  emptyValue?: string;
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  space?: string | number;
}

declare function stringer(options: any): Transform;
