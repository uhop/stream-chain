// @ts-self-types="./unbatch.d.ts"

// `unbatch()` forces a function-section boundary that unbundles a `many()`
// chunk into individual items. The chain already fans a `many()` out at every
// function section — on the way in (`processInput`) and on the way out
// (`processValue`) — so a synchronous pass-through is all that's needed: no
// generator, no machinery. Drop it between a `batched()`-emitting stage and a
// per-item consumer that can't unbundle `many()` itself. Substrate-agnostic.
const unbatch = () => value => value;

export default unbatch;
export {unbatch};
