import type {Arg0, Ret, Flatten, Fn} from './defs';

export = gen;

export type FnItem<I, F> = F extends readonly [infer F1, ...infer R]
  ? readonly [FnItem<I, F1>, ...FnList<Ret<F1>, R>]
  : F extends readonly unknown[]
  ? readonly [FnItem<I, any>]
  : F extends Fn
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
): Flatten<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => AsyncGenerator<Ret<L>, void, unknown>
  : (arg: any) => AsyncGenerator<any, void, unknown>;
