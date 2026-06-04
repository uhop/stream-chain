'use strict';

// Pure + Web-Streams test helpers. Importing this file must not pull `node:*`
// — these helpers back the browser-safe /core and /web test buckets.

import chain from '../src/web/index.js';

export const delay =
  (fn, ms = 20) =>
  (...args) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(fn(...args));
        } catch (error) {
          reject(error);
        }
      }, ms);
    });

export const webStreamToArray = array =>
  new WritableStream({
    write(chunk) {
      array.push(chunk);
    }
  });

export const writeAndCollect = async (transform, values) => {
  // Feed values + close in parallel with draining the readable side.
  // Used by asWebStream fast-path tests to mirror "stream.write(...); stream.end()" patterns.
  const writer = transform.writable.getWriter();
  const writePromise = (async () => {
    for (const v of values) await writer.write(v);
    await writer.close();
  })();
  const out = [];
  const reader = transform.readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    out.push(value);
  }
  await writePromise;
  return out;
};

// Build a `/web` chain from the given transducers, feed it `input`, drain the
// readable side, return the collected output. The substrate-agnostic equivalent of
// `chain([readableFrom(input), ...transducers, streamToArray(out)]) + c.on('end', cb)`
// from the node-side test helpers — same shape, no node:stream dependency.
export const runChain = async (transducers, input) => {
  const c = chain(transducers);
  const writer = c.writable.getWriter();
  const reader = c.readable.getReader();
  const out = [];
  const readP = (async () => {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();
  for (const v of input) await writer.write(v);
  await writer.close();
  await readP;
  return out;
};
