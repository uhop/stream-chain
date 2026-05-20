// @ts-self-types="./asWebStream.d.ts"

import * as defs from '../defs.js';
import gen from '../gen.js';

// Web Streams shape detection (duck-typed — no `node:*` imports).
const isReadableWebStream = x =>
  !!(x && typeof x === 'object' &&
    typeof x.getReader === 'function' &&
    typeof x.pipeTo === 'function');

const isWritableWebStream = x =>
  !!(x && typeof x === 'object' &&
    typeof x.getWriter === 'function' &&
    typeof x.abort === 'function');

const isDuplexWebStream = x =>
  !!(x && typeof x === 'object' &&
    isReadableWebStream(x.readable) && isWritableWebStream(x.writable));

// Wrap a function (or fun/gen-wrapped function list) as a TransformStream.
// Uses gen() so all sync/async/generator/Many/None/Stop/Final/flushable semantics work.
const wrapFunctionStage = (fn) => {
  const g = defs.isFunctionList(fn) ? gen(...defs.getFunctionList(fn)) : gen(fn);
  return new TransformStream({
    async transform(chunk, controller) {
      for await (const value of g(chunk)) {
        controller.enqueue(value);
      }
    },
    async flush(controller) {
      for await (const value of g(defs.none)) {
        controller.enqueue(value);
      }
    }
  });
};

/**
 * Dual role (same shape as 3.x `asStream`):
 *   - Pass a Web Streams object → returned as-is (in-chain executor type hint).
 *   - Pass a function → wrapped as a TransformStream that runs via gen() dispatch.
 */
const asWebStream = (input) => {
  if (isDuplexWebStream(input)) return input;
  if (isReadableWebStream(input)) return input;
  if (isWritableWebStream(input)) return input;
  if (typeof input === 'function') return wrapFunctionStage(input);
  throw new TypeError(
    'asWebStream: expected a function or Web Streams object (Readable, Writable, or {readable, writable} duplex pair)'
  );
};

export default asWebStream;
export {asWebStream, isReadableWebStream, isWritableWebStream, isDuplexWebStream};
