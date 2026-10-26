// @ts-self-types="./fixUtf8Stream.d.ts"

import {none, flushable} from '../defs.js';

// The WHATWG decoding rule: a U+FEFF that starts the first output is a byte-order
// mark. Applied here for every input on every runtime: StringDecoder keeps the BOM,
// and Deno 2.9.8's TextDecoder also drops a U+FEFF that starts a later decode() call
// (denoland/deno#37090).
const dropBOM = s => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// The BOM check is an inline flag, not a self-replacing function: the pipeline holds
// this stage, so swapping it needs a trampoline call per chunk (+10% on 64-byte chunks).

const makeTextDecoderImpl = options => {
  const textDecoder = new TextDecoder('utf-8', {ignoreBOM: true});
  let atStart = !options?.ignoreBOM;
  return flushable(chunk => {
    let s;
    if (chunk === none) s = textDecoder.decode();
    else if (typeof chunk == 'string') s = chunk;
    else if (chunk instanceof Uint8Array) s = textDecoder.decode(chunk, {stream: true});
    else throw new TypeError('Expected a string or a Uint8Array');
    if (!atStart || !s) return s;
    atStart = false;
    return dropBOM(s);
  });
};

const makeStringDecoderImpl = StringDecoder => options => {
  const stringDecoder = new StringDecoder();
  let atStart = !options?.ignoreBOM;
  return flushable(chunk => {
    let s;
    if (chunk === none) s = stringDecoder.end();
    else if (typeof chunk == 'string') s = chunk;
    else if (chunk instanceof Uint8Array) s = stringDecoder.write(chunk);
    else throw new TypeError('Expected a string or a Uint8Array');
    if (!atStart || !s) return s;
    atStart = false;
    return dropBOM(s);
  });
};

// Default to TextDecoder — works in every runtime (Node, Bun, Deno, browser).
// On Node, asynchronously upgrade to StringDecoder, 2–7× faster on the decoder
// hot path on Node 24 and 26 (on Node 22: 3.5× on ASCII, slower on multi-byte
// text; bench/decoder-stringdecoder-vs-textdecoder.js, 2026-10-26).
// Fire-and-forget: composing fixUtf8Stream() before the upgrade lands yields a
// TextDecoder-backed stage; after, a StringDecoder-backed one. Both drop a
// leading BOM. Callers needing the fast path on Node can `await whenReady()`
// before composition.
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

const fixUtf8Stream = options => impl(options);
const whenReady = () => readyPromise;

export default fixUtf8Stream;
export {fixUtf8Stream, whenReady};
