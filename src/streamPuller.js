// @ts-self-types="./streamPuller.d.ts"

// Wraps a Node Readable as an awaitable item source. Backpressure via
// pause()/resume(). Original 'error' value preserved — no AbortError
// wrapping like Node's Readable[Symbol.asyncIterator]().
//
// Premature close (stream destroyed without emitting 'end' or 'error') is
// surfaced as a synthetic Error('Premature stream close') so pending
// waiters don't hang.

const makeStreamPuller = stream => {
  const queue = []; // buffered chunks (when no waiter is parked)
  const waiters = []; // {resolve, reject} for pending next() calls
  let ended = false;
  let errored = null;

  const onData = chunk => {
    if (waiters.length) {
      waiters.shift().resolve({value: chunk, done: false});
      return;
    }
    queue.push(chunk);
    stream.pause();
  };
  const onEnd = () => {
    ended = true;
    while (waiters.length) waiters.shift().resolve({value: undefined, done: true});
  };
  const onError = err => {
    if (errored) return;
    errored = err;
    while (waiters.length) waiters.shift().reject(err);
  };
  const onClose = () => {
    if (ended || errored) return;
    const err = new Error('Premature stream close');
    errored = err;
    while (waiters.length) waiters.shift().reject(err);
  };

  stream.on('data', onData).on('end', onEnd).on('error', onError).on('close', onClose);

  const next = () =>
    new Promise((resolve, reject) => {
      if (errored) return reject(errored);
      if (queue.length) {
        resolve({value: queue.shift(), done: false});
        if (stream.isPaused() && queue.length === 0) stream.resume();
        return;
      }
      if (ended) return resolve({value: undefined, done: true});
      waiters.push({resolve, reject});
      if (stream.isPaused()) stream.resume();
    });

  const close = () => {
    stream.off('data', onData).off('end', onEnd).off('error', onError).off('close', onClose);
  };

  return {next, close};
};

export default makeStreamPuller;
export {makeStreamPuller};
