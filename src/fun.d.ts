import type {Many, AsFlatList, Arg0, Ret, Fn} from './defs';
import type {FnList} from './gen';

export = fun;

/**
 * Returns a wrapped identity function. Rarely used.
 */
declare function fun(): (arg: any) => Promise<Many<any>>;

/**
 * Returns a function that applies the given functions in sequence wrapping them as
 * an asynchronous function.
 * @param fns functions to be wrapped
 * @returns an asynchronous function
 * @remark It collects values and return them as a {@link Many}.
 */
declare function fun<L extends unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): AsFlatList<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => Promise<Many<Ret<L>>>
  : (arg: any) => Promise<Many<any>>;
