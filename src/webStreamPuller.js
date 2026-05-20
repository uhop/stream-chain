// @ts-self-types="./webStreamPuller.d.ts"

// Wraps a Web Streams ReadableStream as an awaitable item source. Thin
// wrapper over ReadableStreamDefaultReader — backpressure is internal to
// the stream, errors come through `reader.read()` rejection, and natural
// end is the standard `{value: undefined, done: true}`.
//
// The Web Streams substrate already gives us most of what the Node puller
// reconstructs by hand: the only thing this wrapper adds is `close()` for
// API parity (releaseLock) and `cancel(reason)` to cancel the underlying
// stream (since `getReader()` locks it, the caller can't cancel it
// directly).

const makeWebStreamPuller = stream => {
  const reader = stream.getReader();
  let closed = false;

  const next = () => {
    if (closed) return Promise.resolve({value: undefined, done: true});
    return reader.read();
  };

  const close = () => {
    if (closed) return;
    closed = true;
    reader.releaseLock();
  };

  const cancel = reason => {
    if (closed) return Promise.resolve();
    closed = true;
    // Cancel rejects pending reads with `done: true`; we then release the
    // lock so `stream.locked` reflects the puller's withdrawal. Always
    // releaseLock — even on cancel rejection — so the lock doesn't leak.
    const release = () => reader.releaseLock();
    return reader.cancel(reason).then(release, err => {
      release();
      throw err;
    });
  };

  return {next, close, cancel};
};

export default makeWebStreamPuller;
export {makeWebStreamPuller};
