// @ts-self-types="./asWebStream.d.ts"

import {Duplex, Readable, Writable} from 'node:stream';

/**
 * Materialize a Node-side chain (or any Node stream) as a Web Streams object.
 * Thin sugar over `Duplex.toWeb()` / `Readable.toWeb()` / `Writable.toWeb()` — uses the
 * runtime's native conversion at the boundary so users in `/node` can hand a chain
 * to Web-Streams-consuming code without leaving the Node pipeline internally.
 */
const asWebStream = stream => {
  if (!stream || typeof stream !== 'object') {
    throw new TypeError('asWebStream: expected a Node stream (Duplex/Readable/Writable)');
  }
  // Duplex (has both readable and writable interfaces)
  if (typeof stream.write === 'function' && typeof stream.read === 'function') {
    return Duplex.toWeb(stream);
  }
  // Pure Readable (only read, no write)
  if (typeof stream.read === 'function' && typeof stream.pipe === 'function') {
    return Readable.toWeb(stream);
  }
  // Pure Writable (only write, no read)
  if (typeof stream.write === 'function') {
    return Writable.toWeb(stream);
  }
  throw new TypeError(
    'asWebStream: argument is not a recognizable Node stream (Duplex/Readable/Writable)'
  );
};

export default asWebStream;
export {asWebStream};
