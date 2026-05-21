// @ts-self-types="./fixUtf8Stream.d.ts"

import {none, flushable} from '../defs.js';

const makeTextDecoderImpl = () => {
  const textDecoder = new TextDecoder();
  let input = '';
  return flushable(chunk => {
    if (chunk === none) {
      const result = input + textDecoder.decode();
      input = '';
      return result;
    }
    if (typeof chunk == 'string') {
      if (!input) return chunk;
      const result = input + chunk;
      input = '';
      return result;
    }
    if (chunk instanceof Uint8Array) {
      const result = input + textDecoder.decode(chunk, {stream: true});
      input = '';
      return result;
    }
    throw new TypeError('Expected a string or a Uint8Array');
  });
};

const makeStringDecoderImpl = StringDecoder => () => {
  const stringDecoder = new StringDecoder();
  let input = '';
  return flushable(chunk => {
    if (chunk === none) {
      const result = input + stringDecoder.end();
      input = '';
      return result;
    }
    if (typeof chunk == 'string') {
      if (!input) return chunk;
      const result = input + chunk;
      input = '';
      return result;
    }
    if (chunk instanceof Uint8Array) {
      const result = input + stringDecoder.write(chunk);
      input = '';
      return result;
    }
    throw new TypeError('Expected a string or a Uint8Array');
  });
};

// Default to TextDecoder — works in every runtime (Node, Bun, Deno, browser).
// On Node, asynchronously upgrade to StringDecoder which is 2–4× faster on the
// decoder hot path. Fire-and-forget: composing fixUtf8Stream() before the
// upgrade lands yields a TextDecoder-backed stage (still correct); after, a
// StringDecoder-backed one. Callers needing the fast path on Node can
// `await whenReady()` before composition.
//
// Bun and Deno stay on TextDecoder per benchmarks: Bun is a wash, Deno
// actively prefers TextDecoder over its node-compat StringDecoder.

let impl = makeTextDecoderImpl;

const isDeno = typeof globalThis['Deno'] == 'object' && globalThis['Deno']?.version;
const isBun = typeof globalThis['Bun'] == 'object' && globalThis['Bun']?.version;
const isNode = !isDeno && !isBun && typeof process == 'object' && process?.versions?.node;

const readyPromise = isNode
  ? import('node:string_decoder').then(
      ({StringDecoder}) => {
        impl = makeStringDecoderImpl(StringDecoder);
      },
      () => {} // squelch — stick with TextDecoder
    )
  : Promise.resolve();

const fixUtf8Stream = () => impl();
const whenReady = () => readyPromise;

export default fixUtf8Stream;
export {fixUtf8Stream, whenReady};
