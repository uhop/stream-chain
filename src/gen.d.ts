export = gen;

export type Fn = (chunk: any, encoding?: string) => unknown;
export type Iter = Iterable<unknown> | AsyncIterable<unknown>;

type GenType<Self> = Fn | Iter | null | undefined | Self[];

interface GenArg extends GenType<GenArg> {}

declare function gen(...fns: GenArg[]): AsyncIterableIterator<unknown>;
