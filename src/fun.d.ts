export = fun;

export type Fn = (chunk: unknown, encoding?: string) => unknown;
export type Iter = Iterable<unknown> | AsyncIterable<unknown>;

type FunType<Self> = Fn | Iter | null | undefined | Self[];

interface FunArg extends FunType<FunArg> {}

declare function fun(...fns: FunArg[]): Promise<unknown>;
