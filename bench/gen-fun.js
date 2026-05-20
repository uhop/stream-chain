import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import {getManyValues} from 'stream-chain/defs.js';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const g = gen(...fns),
  f = fun(...fns);

export default {
  async gen(n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for await (const x of g(i)) {
        acc += x;
      }
    }
    return acc;
  },
  async fun(n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for (const x of getManyValues(await f(i))) {
        acc += x;
      }
    }
    return acc;
  }
};
