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
 * backpressuring push made it suspend. A `stop` during the flush resumes it after
 * the stopper, and the last `Stop` is rethrown at the end. With an owner's
 * `finished` set, it skips the stages in it and adds each stage whose `final`
 * completes. Used by the drivers' `none` path and by `finishStop`.
 */
declare function flush(
  fns: Fn[],
  index: number,
  push: Push,
  finished?: Set<Fn>
): void | Promise<void>;

/**
 * Builds a sync-when-possible, value-or-promise executor over the given
 * functions. The returned driver threads a value through the function-list and
 * emits terminal values via `push`; it stays synchronous until a real promise
 * (async stage or a backpressure push) appears, then suspends and resumes.
 * Calling the driver with `none` flushes flushable stages.
 *
 * Unlike `fun()` / `gen()`, the `push` return value is honored: a Promise
 * suspends the executor AT that push, preserving a bounded queue. After a `stop`,
 * the driver's `none` call flushes only the stages after the stopper (as in
 * `gen()` and `fun()`).
 *
 * @param fns functions to compose: regular, async, generator, async generator,
 *   or nested arrays / function-lists. Falsy items are ignored; an empty list
 *   becomes identity.
 * @returns a `(value, push)` driver tagged as a function-list.
 */
declare function exec(
  ...fns: Array<Fn | ReadonlyArray<Fn> | null | undefined | false>
): (value: unknown, push: Push) => void | Promise<void>;

/**
 * The error an abnormal exit surfaces when a generator's own cleanup also fails.
 * Internal: shared by the executor and the stream adapters.
 */
declare function withCleanupError(err: unknown, cleanupErr: unknown): unknown;

/**
 * Set on a push function by its owner on teardown, to the value the executor
 * throws before a generator's next yield. Internal: shared with the adapters.
 */
declare const cancelSymbol: unique symbol;

/**
 * Whether any stage in `fns` has an `abort`. Internal: shared by the pipeline owners.
 */
declare function hasAborters(fns: readonly Fn[]): boolean;

/**
 * Adds `fn` to `finished` once its `final` completes: at once for a plain value, on
 * resolution for a promise, which is returned in its place. Internal: shared by the
 * pipeline owners.
 */
declare function noteFinal<T>(value: T, fn: Fn, finished: Set<Fn>): T;

/**
 * Calls the `abort` of each stage in `fns[0..to)` that is not in `finished`, in
 * order, adding it first; resolves to the failure to surface, or `undefined`.
 * Internal: shared by the pipeline owners.
 */
declare function abortStages(fns: readonly Fn[], finished: Set<Fn>, to?: number): Promise<unknown>;

/**
 * Where the flush after a `stop` starts: the index of the stage after the stopper,
 * or `fns.length` when the `Stop` carries none. Internal: shared by the owners.
 */
declare function stopIndex(stop: unknown, fns: readonly Fn[]): number;

/**
 * After a `stop`, releases the stopper and the stages before it that are not in
 * `finished`; if that fails, releases the rest too, since no flush follows. Resolves
 * to the failure to surface, or `undefined`. Internal: shared by `gen()` and
 * `finishStop`.
 */
declare function releaseStopped(
  fns: readonly Fn[],
  finished: Set<Fn>,
  stop: unknown
): Promise<unknown>;

/**
 * Ends a pipeline after a `stop` for an owner that flushes on its own: flushes the
 * stages after the stopper, then releases the stopper and the stages before it; a
 * failing flush releases every stage not in `finished`. Internal: shared by
 * `asStream` and `asWebStream`.
 */
declare function finishStop(
  fns: readonly Fn[],
  stop: unknown,
  push: Push,
  finished: Set<Fn>
): Promise<void>;

export default exec;
export {
  exec,
  next,
  flush,
  withCleanupError,
  cancelSymbol,
  hasAborters,
  noteFinal,
  abortStages,
  stopIndex,
  releaseStopped,
  finishStop
};
