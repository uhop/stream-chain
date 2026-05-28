/**
 * One-shot single-value driver for a gen pipeline. Returns an async generator
 * function that, when called with a value, drives the value through the
 * composed stages and then flushes the pipeline (so sink-stage flushables
 * such as `asyncBlockWriter` run their `final()`).
 */
declare function pipe(
  ...stages: unknown[]
): <T = unknown>(value?: unknown) => AsyncGenerator<T, void, unknown>;

export default pipe;
export {pipe};
