import type {Many, AsFlatList, Arg0, Ret, Fn} from './defs.js';
import type gen from './gen.js';

/**
 * Returns a wrapped identity function — `fun()` with no arguments produces a
 * function that returns its input wrapped in a single-value {@link Many}. Rarely used directly.
 * @returns a function whose call returns `Many<unknown>` synchronously, or `Promise<Many<unknown>>` if the input requires async handling.
 */
declare function fun(): (arg: unknown) => Many<unknown> | Promise<Many<unknown>>;

/**
 * Returns a sync-first function that applies the given functions in sequence and
 * collects every output value into a `Many`. For purely synchronous pipelines the
 * result is returned synchronously; if any stage is async (Promise / async generator
 * / async fn), the result is wrapped in a `Promise`.
 * @param fns functions to be composed: regular, async, generator, async generator, or
 *   nested arrays/function-lists. Falsy items are ignored.
 * @returns a function whose call returns `Many<Ret<L>>` synchronously or `Promise<Many<Ret<L>>>` when async stages are involved.
 * @remarks Special return values (`none`, `stop`, `many`, `finalValue`, `flushable`) are honored. Generator outputs are collected into the result `Many` as individual values.
 */
declare function fun<L extends unknown[]>(
  ...fns: gen.FnList<Arg0<L>, L>
): AsFlatList<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => Many<Ret<L>> | Promise<Many<Ret<L>>>
  : (arg: unknown) => Many<unknown> | Promise<Many<unknown>>;

export default fun;
export {fun};
