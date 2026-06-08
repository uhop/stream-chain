/**
 * One-shot single-value driver for a gen pipeline. Returns an async generator
 * function that, when called with a value, drives the value through the
 * composed stages and, on successful completion, flushes the pipeline (so
 * sink-stage flushables such as `asyncBlockWriter` run their `final()`). If a
 * stage throws, the error propagates and the flush is skipped — a failed
 * pipeline is not finalized.
 */
declare function pipe(
  ...stages: unknown[]
): <T = unknown>(value?: unknown) => AsyncGenerator<T, void, unknown>;

export default pipe;
export {pipe};
