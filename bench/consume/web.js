// Output consumption on Web Streams — terminal function (accumulate inside the
// chain) vs a manual reader loop vs pipeTo(WritableStream) vs the
// makeWebStreamPuller async-iterator helper.
//
// Upstream is identical: webChain([source, ...fns]) producing 1..n (the five
// fns net to the identity). Web Streams have no 'data' event, so the consumption
// alternatives differ from Node's. The terminal-function case appends a plain fn
// returning `none`, so the readable carries no values and is drained with a
// no-op pipeTo. Every case returns sum(1..n) = n*(n+1)/2.
//
// n = items per run; see RESULTS.md.

import webChain, {none} from 'stream-chain/web';
import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

// Seed the chain: write the single value n (the source generator's argument),
// then close. Returns the write/close promise to await once output is drained.
const feed = (c, n) => {
  const writer = c.writable.getWriter();
  return writer.write(n).then(() => writer.close());
};

export default {
  async ['terminal function'](n) {
    let acc = 0;
    const c = webChain([
      source,
      ...fns,
      x => {
        acc += x;
        return none;
      }
    ]);
    const wp = feed(c, n);
    await c.readable.pipeTo(new WritableStream()); // drain; carries no values
    await wp;
    return acc;
  },

  async ['reader loop'](n) {
    let acc = 0;
    const c = webChain([source, ...fns]);
    const wp = feed(c, n);
    const reader = c.readable.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      acc += value;
    }
    await wp;
    return acc;
  },

  async ['pipeTo(WritableStream)'](n) {
    let acc = 0;
    const c = webChain([source, ...fns]);
    const wp = feed(c, n);
    await c.readable.pipeTo(
      new WritableStream({
        write(x) {
          acc += x;
        }
      })
    );
    await wp;
    return acc;
  },

  async ['makeWebStreamPuller'](n) {
    let acc = 0;
    const c = webChain([source, ...fns]);
    const wp = feed(c, n);
    for await (const x of makeWebStreamPuller(c.readable)) acc += x;
    await wp;
    return acc;
  }
};
