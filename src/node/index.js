// @ts-self-types="./index.d.ts"

// /node subpath entry — re-exports the canonical chain runtime from `src/index.js`,
// plus the Node-side `asWebStream` materializer added in v4.

import chain from '../index.js';
import asWebStream from './asWebStream.js';

// Attach `asWebStream` to chain for parity with `chain.asStream` (override-hook pattern).
// `/** @type {any} */` cast matches the documented chain-static convention.
/** @type {any} */ (chain).asWebStream = asWebStream;

export default chain;
export * from '../index.js';
export {asWebStream};
