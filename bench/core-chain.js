// /core comparison: /core's chain (lifted async-iterable transformer) vs the
// underlying gen() called directly with the same fn-list.
//
// Both process the same work — source-generator expanding n → 1..n, then through
// 5 fns. The difference is /core's outer `for await (v of input) yield* g(v)`
// wrapper (the iterable-lifting layer).

import gen from 'stream-chain/gen.js';
import coreChain from 'stream-chain/core';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

export default {
  async ['core chain'](n) {
    let acc = 0;
    const c = coreChain([source, gen(...fns)]);
    for await (const x of c([n])) acc += x;
    return acc;
  },

  async ['gen with source'](n) {
    const g = gen(source, ...fns);
    let acc = 0;
    for await (const x of g(n)) acc += x;
    return acc;
  }
};
