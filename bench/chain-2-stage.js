// 2-stage chain comparison: /node vs /web.
//
// Same workload as chain-1-stage.js, but the second stage is explicitly wrapped
// (asStream(g) / asWebStream(g)) so the chain's groupFunctions sees it as a
// pre-built stream item and does NOT merge it into the function group. Result:
// two stages piped together (source as stage 1, fn-chain as stage 2).

import gen from 'stream-chain/gen.js';
import chain, {asStream, asWebStream} from 'stream-chain';
import webChain from 'stream-chain/web';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];
const g = gen(...fns);

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

export default {
  async ['node chain — 2 stages'](n) {
    return new Promise((resolve, reject) => {
      let acc = 0;
      const pipe = chain([source, asStream(g)]);
      pipe.on('data', x => (acc += x));
      pipe.on('finish', () => resolve(acc));
      pipe.on('error', reject);
      pipe.end(n);
    });
  },

  async ['web chain — 2 stages'](n) {
    let acc = 0;
    const c = webChain([source, asWebStream(g)]);
    const writer = c.writable.getWriter();
    const writePromise = writer.write(n).then(() => writer.close());
    const reader = c.readable.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      acc += value;
    }
    await writePromise;
    return acc;
  }
};
