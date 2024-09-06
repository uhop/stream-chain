export = parser;

interface OutputItem {
  key: number;
  value: unknown;
}

type Reviver = (this: unknown, key: string, value: unknown) => unknown;

declare function parser(reviver?: Reviver): AsyncIterableIterator<OutputItem>;
