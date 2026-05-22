/** A reducer function prototype. */
type Reducer<A, T> = (this: ReduceWebStreamOutput<A, T>, acc: A, value: T) => A;
/** An asynchronous reducer function prototype. */
type ReducerPromise<A, T> = (this: ReduceWebStreamOutput<A, T>, acc: A, value: T) => Promise<A>;

/**
 * Options for the `reduceWebStream` function.
 */
interface ReduceWebStreamOptions<A, T> {
  /** A reducer function. */
  reducer?: Reducer<A, T> | ReducerPromise<A, T>;
  /** An initial accumulator. */
  initial?: A;
  /** Optional Web Streams `QueuingStrategy` for the writable side. */
  strategy?: QueuingStrategy<T>;
  /** Optional Web Streams `QueuingStrategy` for the writable side (overrides `strategy`). */
  writableStrategy?: QueuingStrategy<T>;
}

/**
 * The result of `reduceWebStream` — a `WritableStream` paired with a `Promise`
 * that resolves to the final accumulator on clean close, plus a live
 * `accumulator` getter that exposes the running value. Symmetric to
 * `ReduceStreamOutput` (Node's `Writable & {accumulator}`).
 */
interface ReduceWebStreamOutput<A, T> {
  /** The writable side. Pipe input into this. */
  readonly writable: WritableStream<T>;
  /** Resolves to the final accumulator on clean close; rejects on abort or reducer error. */
  readonly result: Promise<A>;
  /** Live view of the running accumulator (also passed to the reducer as `this.accumulator`). */
  readonly accumulator: A;
}

/**
 * Creates a `WritableStream` that reduces its input to a single value via a
 * reducer. Counterpart to `reduceStream` (Node `Writable` with `.accumulator`)
 * for the Web Streams substrate. The final value is delivered via the
 * `result` promise on the returned `{writable, result}` pair.
 *
 * @param options options for the reduceWebStream (see {@link ReduceWebStreamOptions}).
 * @returns a `{writable, result}` pair — see {@link ReduceWebStreamOutput}.
 * @remarks Modelled on the [reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) method.
 */
declare function reduceWebStream<A, T>(
  options: ReduceWebStreamOptions<A, T>
): ReduceWebStreamOutput<A, T>;
/**
 * Creates a `WritableStream` that reduces its input to a single value via a reducer.
 * @param reducer a reducer function (sync or async).
 * @param initial the initial accumulator value.
 * @returns a `{writable, result}` pair — see {@link ReduceWebStreamOutput}.
 */
declare function reduceWebStream<A, T>(
  reducer: Reducer<A, T> | ReducerPromise<A, T>,
  initial: A
): ReduceWebStreamOutput<A, T>;

export default reduceWebStream;
export {reduceWebStream};
