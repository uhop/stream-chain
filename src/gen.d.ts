import type {Arg0, Ret, AsFlatList, Fn} from './defs';

export = gen;

/**
 * Returns a type, which was expected from a list item.
 * It is used to highlight mismatches between argument types and return types in a list.
 */
export type FnItem<I, F> = F extends readonly [infer F1, ...infer R]
  ? F1 extends (null | undefined)
    ? readonly [F1, ...FnList<I, R>]
    : readonly [FnItem<I, F1>, ...FnList<Ret<F1, I>, R>]
  : F extends readonly unknown[]
  ? readonly [FnItem<I, any>]
  : F extends Fn
  ? I extends Arg0<F>
    ? F
    : (arg: I, ...rest: readonly unknown[]) => ReturnType<F>
  : F extends (null | undefined)
  ? F
  : never;

/**
 * Replicates a tuple verifying the types of the list items so arguments match returns.
 * The replicated tuple is used to highlight mismatches between list items.
 */
export type FnList<I, L> = L extends readonly [infer F1, ...infer R]
  ? F1 extends (null | undefined)
    ? readonly [F1, ...FnList<I, R>]
    : readonly [FnItem<I, F1>, ...FnList<Ret<F1, I>, R>]
  : L;

/**
 * Returns a wrapped identity function. Rarely used.
 */
declare function gen(): (arg: any) => AsyncGenerator<any, void, unknown>;
/**
 * Returns a function that applies the given functions in sequence wrapping them as
 * an asynchronous generator.
 * @param fns functions to be wrapped
 * @returns an asynchronous generator
 */
declare function gen<L extends readonly unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): AsFlatList<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => AsyncGenerator<Ret<L>, void, unknown>
  : (arg: any) => AsyncGenerator<any, void, unknown>;
