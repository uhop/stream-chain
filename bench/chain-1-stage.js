// 1-stage chain comparison: /node vs /web.
//
// Both chains have the same shape: [source-generator, ...5 fns]. The chain's
// flattening + grouping + gen()'s own flattening collapse them into a single
// asStream(gen(source, ...fns)) / asWebStream(gen(source, ...fns)) stage.

import gen from 'stream-chain/gen.js';
import chain from 'stream-chain';
import webChain from 'stream-chain/web';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];
const g = gen(...fns);

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

export default {
  async ['node chain — 1 stage'](n) {
    return new Promise((resolve, reject) => {
      let acc = 0;
      const pipe = chain([source, g]);
      pipe.on('data', x => (acc += x));
      pipe.on('finish', () => resolve(acc));
      pipe.on('error', reject);
      pipe.end(n);
    });
  },

  async ['web chain — 1 stage'](n) {
    let acc = 0;
    const c = webChain([source, g]);
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
