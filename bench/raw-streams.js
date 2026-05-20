// Minimal substrate comparison using the LOWER-LEVEL DUPLEX primitives — the same
// primitives the project itself uses (asStream → Duplex, asWebStream → {readable,
// writable} pair). No Transform / TransformStream — those are higher-level
// abstractions with their own batching that we don't use internally.
//
// "Push a number, get number + 1 back." Single duplex, n chunks in, n chunks out.
//
// PROPER backpressure on both sides:
//   - Node Duplex: if this.push() returns false, save the write-callback and
//     fire it from _read() when the consumer pulls. The writable side stays
//     throttled until the readable drains.
//   - Web duplex: if controller.desiredSize <= 0 after enqueue, return a Promise
//     from write() that resolves when the ReadableStream's pull() fires (=
//     consumer asked for more). The writable side awaits before accepting next.

import {Duplex} from 'node:stream';

const makeNodeDuplex = () =>
  new Duplex({
    objectMode: true,
    write(chunk, _, callback) {
      if (this.push(chunk + 1)) {
        callback();
      } else {
        // Backpressure: save callback, fire from read() when consumer wants more.
        this._pendingCb = callback;
      }
    },
    read() {
      const cb = this._pendingCb;
      if (cb) {
        this._pendingCb = null;
        cb();
      }
    },
    final(callback) {
      this.push(null); // writable end → close readable side
      callback();
    }
  });

const makeWebDuplex = () => {
  let controller;
  let pendingDrain = null;
  const readable = new ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      // Consumer pulled; resolve any pending write-backpressure Promise.
      const resolve = pendingDrain;
      if (resolve) {
        pendingDrain = null;
        resolve();
      }
    }
  });
  const writable = new WritableStream({
    write(chunk) {
      controller.enqueue(chunk + 1);
      if (controller.desiredSize !== null && controller.desiredSize <= 0) {
        // Backpressure: return Promise that resolves when pull() fires.
        return new Promise(resolve => {
          pendingDrain = resolve;
        });
      }
    },
    close() {
      controller.close();
    },
    abort(reason) {
      controller.error(reason);
    }
  });
  return {readable, writable};
};

export default {
  async ['node duplex'](n) {
    return new Promise((resolve, reject) => {
      const d = makeNodeDuplex();
      let acc = 0;
      d.on('data', x => (acc += x));
      d.on('end', () => resolve(acc));
      d.on('error', reject);

      let i = 0;
      const writeMore = () => {
        while (i < n) {
          const value = i++;
          if (!d.write(value)) {
            d.once('drain', writeMore);
            return;
          }
        }
        d.end();
      };
      writeMore();
    });
  },

  async ['web duplex'](n) {
    const {readable, writable} = makeWebDuplex();

    const writePromise = (async () => {
      const writer = writable.getWriter();
      for (let i = 0; i < n; ++i) {
        await writer.write(i); // awaits backpressure (writable.write returns Promise from our write())
      }
      await writer.close();
    })();

    let acc = 0;
    const reader = readable.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      acc += value;
    }
    await writePromise;
    return acc;
  }
};
