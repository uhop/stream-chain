// Replicates chain-1-stage's "burst-enqueue" pattern using raw substrate primitives.
// No project code. Question being tested: does the 159× Web/Node gap reproduce
// without asWebStream involved, or is it asWebStream-specific?
//
// Pattern (same as chain-1-stage but built from scratch):
//   - One writer.write(n) call carrying a single number n
//   - Inside the duplex's write callback: a for-loop expands n → 1..n, pushes
//     (i + 1) per iteration, respecting backpressure between pushes
//   - Reader drains all n outputs
//
// Compare against raw-streams.js which uses the 1-in-1-out feeding pattern.

import {Duplex} from 'node:stream';

// ---- Node Duplex with burst expansion + backpressure ----
const makeBurstNodeDuplex = () =>
  new Duplex({
    objectMode: true,
    write(n, _, callback) {
      let i = 1;
      const writeMore = () => {
        while (i <= n) {
          const v = i++;
          if (!this.push(v + 1)) {
            // backpressure: resume from read() callback
            this._pendingCb = writeMore;
            return;
          }
        }
        callback();
      };
      writeMore();
    },
    read() {
      const cb = this._pendingCb;
      if (cb) {
        this._pendingCb = null;
        cb();
      }
    },
    final(callback) {
      this.push(null);
      callback();
    }
  });

// ---- Web duplex with burst expansion + backpressure ----
const makeBurstWebDuplex = () => {
  let controller;
  let pendingDrain = null;
  const readable = new ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      const resolve = pendingDrain;
      if (resolve) {
        pendingDrain = null;
        resolve();
      }
    }
  });
  const writable = new WritableStream({
    async write(n) {
      for (let i = 1; i <= n; ++i) {
        controller.enqueue(i + 1);
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          await new Promise(resolve => {
            pendingDrain = resolve;
          });
        }
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
  async ['node burst'](n) {
    return new Promise((resolve, reject) => {
      const d = makeBurstNodeDuplex();
      let acc = 0;
      d.on('data', x => (acc += x));
      d.on('end', () => resolve(acc));
      d.on('error', reject);
      d.write(n);
      d.end();
    });
  },

  async ['web burst'](n) {
    const {readable, writable} = makeBurstWebDuplex();

    const writePromise = (async () => {
      const writer = writable.getWriter();
      await writer.write(n);
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
