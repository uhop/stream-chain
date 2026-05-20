// @ts-self-types="./index.d.ts"

// /node subpath entry — re-exports the canonical chain runtime from `src/index.js`.
// `asWebStream` is attached to chain in `src/index.js`; no per-subpath wiring needed.

import chain from '../index.js';

export default chain;
export * from '../index.js';
