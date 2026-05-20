'use strict';

import {Readable, Writable} from 'node:stream';

export const streamToArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      array.push(chunk);
      callback(null);
    }
  });

export const readString = (string, quant) =>
  new Readable({
    read() {
      if (isNaN(quant) || quant < 1) {
        this.push(string);
      } else if (string instanceof Buffer) {
        for (let i = 0; i < string.length; i += quant) {
          this.push(string.slice(i, i + quant));
        }
      } else {
        for (let i = 0; i < string.length; i += quant) {
          this.push(string.slice(i, i + quant));
        }
      }
      this.push(null);
    }
  });

export const writeToArray = array =>
  new Writable({
    write(chunk, _, callback) {
      if (typeof chunk == 'string') {
        array.push(chunk);
      } else {
        array.push(chunk.toString('utf8'));
      }
      callback(null);
    }
  });

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

// Web Streams helpers — mirror the Node helpers above for parallel test suites.

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
