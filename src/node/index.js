// @ts-self-types="./index.d.ts"

// /node subpath entry — re-exports the canonical chain runtime from `src/index.js`.
// In Phase 1 this is a thin pass-through; future phases may relocate the
// implementation here without changing the user-visible export shape.

import chain from '../index.js';

export default chain;
export * from '../index.js';
