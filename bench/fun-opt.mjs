import fun from 'stream-chain/fun.js';
import {clearFunctionList, getManyValues} from 'stream-chain/defs.js';

const f1 = fun(
    x => x - 2,
    x => x + 1,
    x => 2 * x,
    x => x + 2,
    x => x >> 1
  ),
  f2 = fun(
    x => x - 2,
    fun(
      x => x + 1,
      x => 2 * x,
      x => x + 2
    ),
    x => x >> 1
  ),
  f3 = fun(
    x => x - 2,
    clearFunctionList(
      fun(
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
      for (const x of getManyValues(await f1(i))) {
        acc += x;
      }
    }
    return acc;
  },
  async ['optimization on'](n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for (const x of getManyValues(await f2(i))) {
        acc += x;
      }
    }
    return acc;
  },
  async ['optimization off'](n) {
    let acc = 0;
    for (let i = 0; i < n; ++i) {
      for (const x of getManyValues(await f3(i))) {
        acc += x;
      }
    }
    return acc;
  }
};
