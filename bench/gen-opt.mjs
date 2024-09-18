import gen from 'stream-chain/gen.js';
import {clearFunctionList} from 'stream-chain/defs.js';

const g1 = gen(
    x => x - 2,
    x => x + 1,
    x => 2 * x,
    x => x + 2,
    x => x >> 1
  ),
  g2 = gen(
    x => x - 2,
    gen(
      x => x + 1,
      x => 2 * x,
      x => x + 2
    ),
    x => x >> 1
  ),
  g3 = gen(
    x => x - 2,
    clearFunctionList(
      gen(
        x => x + 1,
        x => 2 * x,
        x => x + 2
      )
    ),
    x => x >> 1
  );

export default {
  async ['simple list'](n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for await (const x of g1(i)) {
        acc += x;
      }
    }
    return acc;
  },
  async ['optimization on'](n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for await (const x of g2(i)) {
        acc += x;
      }
    }
    return acc;
  },
  async ['optimization off'](n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for await (const x of g3(i)) {
        acc += x;
      }
    }
    return acc;
  }
};
