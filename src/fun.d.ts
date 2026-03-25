import type {Many, AsFlatList, Arg0, Ret, Fn} from './defs';
import type gen from './gen';

export = fun;

/**
 * Returns a wrapped identity function. Rarely used.
 */
declare function fun(): (arg: unknown) => Many<unknown> | Promise<Many<unknown>>;

/**
 * Returns a function that applies the given functions in sequence.
 * @param fns functions to be wrapped
 * @returns a function that returns a synchronous result or a `Promise`
 * @remarks It collects values and returns them as a {@link Many}.
 */
declare function fun<L extends unknown[]>(
  ...fns: gen.FnList<Arg0<L>, L>
): AsFlatList<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => Many<Ret<L>> | Promise<Many<Ret<L>>>
  : (arg: unknown) => Many<unknown> | Promise<Many<unknown>>;
