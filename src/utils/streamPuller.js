// @ts-self-types="./streamPuller.d.ts"

// Wraps a Node Readable as an async iterator with semantics suited to
// stream-chain's downstream consumers (stream-join, stream-sorting, etc.):
//
//   - Original 'error' value preserved (no AbortError wrapping).
//   - Premature close (.destroy() without 'end' or 'error') surfaces as
//     Error('Premature close').
//   - Breaking out of `for await` does NOT destroy the source — the caller
//     stays in control of the stream's lifecycle.
//
// All three are now provided by Node's built-in `Readable.prototype.iterator`
// (stable in `node:stream`, distinct from the experimental `node:stream/iter`
// module). This wrapper is a thin facade that picks the right options.

const makeStreamPuller = stream => stream.iterator({destroyOnReturn: false});

export default makeStreamPuller;
export {makeStreamPuller};
