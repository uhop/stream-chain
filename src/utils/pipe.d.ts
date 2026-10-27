/**
 * One-shot single-value driver for a gen pipeline. Returns an async generator
 * function that, when called with a value, drives the value through the
 * composed stages and, on successful completion, flushes the pipeline (so
 * sink-stage flushables such as `asyncBlockWriter` run their `final()`). If a
 * stage throws, the error propagates and the flush is skipped — a failed
 * pipeline is not finalized. After a `stop`, the stages after the stopper are
 * flushed, then the stopper and the stages before it are released, and the `Stop`
 * (or a failure of that release) propagates.
 */
declare function pipe(
  ...stages: unknown[]
): <T = unknown>(value?: unknown) => AsyncGenerator<T, void, unknown>;

export default pipe;
export {pipe};
