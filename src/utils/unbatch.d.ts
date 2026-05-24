/**
 * Creates a synchronous pass-through transducer that, placed in a `chain()`,
 * forces a function section which unbundles a `many()` chunk into individual
 * items (the chain fans a `many()` out at every function section).
 * @returns an identity function suitable for use in `chain()`
 * @remarks Insert it between a stage that emits `many()` (e.g. a `batched()`
 * stream) and a per-item consumer that cannot unbundle `many()` on its own.
 * No generator, no buffering — substrate-agnostic.
 */
declare function unbatch<T = unknown>(): (value: T) => T;

export default unbatch;
export {unbatch};
