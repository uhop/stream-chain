import type {Fn} from './defs.js';

/**
 * A push/collect callback. Returns nothing when downstream has room, or a
 * Promise that resolves when it is ready again — a backpressure signal that
 * suspends the executor at that push.
 */
export type Push = (value: any) => void | Promise<void> | undefined;

/**
 * Threads `value` through `fns[index..]`, emitting terminal values via `push`.
 * Returns `undefined` when the traversal ran fully synchronously, or a Promise
 * when it had to suspend (async stage, thenable value, or a backpressure push).
 * The low-level engine; `asStream` / `asWebStream` drive it directly.
 */
declare function next(value: unknown, fns: Fn[], index: number, push: Push): void | Promise<void>;

/**
 * Flushes flushable stages in `fns[index..]`, emitting their buffered output via
 * `push`. Returns `undefined` if synchronous, or a Promise if a flush stage or a
 * backpressuring push made it suspend. Used by the factory's `none` path and by
 * `fun()`/`collect()`.
 */
declare function flush(fns: Fn[], index: number, push: Push): void | Promise<void>;

/**
 * Builds a sync-when-possible, value-or-promise executor over the given
 * functions. The returned driver threads a value through the function-list and
 * emits terminal values via `push`; it stays synchronous until a real promise
 * (async stage or a backpressure push) appears, then suspends and resumes.
 * Calling the driver with `none` flushes flushable stages.
 *
 * Unlike `fun()` / `gen()`, the `push` return value is honored: a Promise
 * suspends the executor AT that push, preserving a bounded queue. `stop` halts
 * without flushing buffered flushables (as in `gen()`; only `fun()` flushes on
 * stop).
 *
 * @param fns functions to compose: regular, async, generator, async generator,
 *   or nested arrays / function-lists. Falsy items are ignored; an empty list
 *   becomes identity.
 * @returns a `(value, push)` driver tagged as a function-list.
 */
declare function exec(
  ...fns: Array<Fn | ReadonlyArray<Fn> | null | undefined | false>
): (value: unknown, push: Push) => void | Promise<void>;

export default exec;
export {exec, next, flush};
