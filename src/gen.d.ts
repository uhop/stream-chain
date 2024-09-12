import type {OutputType, First, Last, Flatten} from './defs';

export = gen;

export type Arg0<F> = F extends readonly unknown[]
  ? Flatten<F> extends readonly [infer F1, ...(readonly unknown[])]
    ? Arg0<F1>
    : Flatten<F> extends readonly (infer F1)[]
    ? Arg0<F1>
    : never
  : F extends (...args: readonly any[]) => unknown
  ? Parameters<F>[0]
  : never;

export type Ret<F> = F extends readonly unknown[]
  ? Flatten<F> extends readonly [...unknown[], infer F1]
    ? Ret<F1>
    : never
  : F extends function
  ? OutputType<F>
  : never;

export type FnItem<I, F> = F extends readonly [infer F1, ...infer R]
  ? readonly [FnItem<I, F1>, ...FnList<Ret<F1>, R>]
  : F extends function[]
  ? readonly [FnItem<I, F[number]>]
  : F extends function
  ? I extends Arg0<F>
    ? F
    : (arg: I, ...rest: readonly unknown[]) => ReturnType<F>
  : never;

export type FnList<I, L> = L extends readonly [infer F1, ...infer R]
  ? readonly [FnItem<I, F1>, ...FnList<Ret<F1>, R>]
  : L;

declare function gen(): (arg: any) => AsyncGenerator<any, void, unknown>;
declare function gen<L extends readonly unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): Flatten<L> extends readonly [function, ...function[]]
  ? (arg: Arg0<L>) => AsyncGenerator<Ret<L>, void, unknown>
  : (arg: any) => AsyncGenerator<any, void, unknown>;
  // : Flatten<L> extends function[]
  // ? (arg: any) => AsyncGenerator<any, void, unknown>
  // : never;
