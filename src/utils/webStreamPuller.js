// @ts-self-types="./webStreamPuller.d.ts"

// Wraps a Web Streams ReadableStream as an async iterator. Built on the
// native `stream[Symbol.asyncIterator]({preventCancel: true})` plus a
// `cancel(reason)` extension — the protocol's `return()` can't carry a
// cancel reason cleanly, so cancel-with-reason is a separate method.

const makeWebStreamPuller = stream => {
  const iter = stream[Symbol.asyncIterator]({preventCancel: true});
  return {
    next: () => iter.next(),
    return: value => iter.return(value),
    // Release the lock (via return) then cancel the source with the reason.
    cancel: reason => iter.return().then(() => stream.cancel(reason)),
    [Symbol.asyncIterator]() {
      return this;
    }
  };
};

export default makeWebStreamPuller;
export {makeWebStreamPuller};
