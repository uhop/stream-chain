// Compare old (flag-only, queue swells) vs new (per-item-await) asStream on the
// same workload that exposed asWebStream's swelling: input chunk n expands via a
// source generator into N outputs through a 5-fn chain.

import gen from 'stream-chain/gen.js';
import asStreamNew from '../src/asStream.js';
import asStreamOld from './asStream2.js';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

const run = (impl, n) =>
  new Promise((resolve, reject) => {
    let acc = 0;
    const s = impl(gen(source, ...fns));
    s.on('data', x => (acc += x));
    s.on('end', () => resolve(acc));
    s.on('error', reject);
    s.end(n);
  });

export default {
  async ['asStream old (flag, swells)'](n) {
    return run(asStreamOld, n);
  },
  async ['asStream new (per-item bp)'](n) {
    return run(asStreamNew, n);
  }
};
