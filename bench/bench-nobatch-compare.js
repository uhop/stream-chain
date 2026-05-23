// Throwaway: compares the no-batch path against the pre-batching commit.
// Uses only APIs present before the batching work (no batched()/{batch}), so
// the same file runs against both the current src and the ebb2684 worktree.
//   node ~/Open/nano-bench/bin/nano-bench.js -i 200000 -s 60 bench/bench-nobatch-compare.js

import chain from '../src/index.js';
import readableFrom from '../src/utils/readableFrom.js';
import {Writable} from 'node:stream';

const POOL = 4096;
const pool = Array.from({length: POOL}, (_, i) => ({name: 'numberValue', value: String(i)}));

const sink = onItem =>
  new Writable({
    objectMode: true,
    write(_c, _e, cb) {
      onItem();
      cb();
    }
  });

const run = (n, makeInputs, sectionFns) =>
  new Promise((resolve, reject) => {
    let count = 0;
    const s = sink(() => ++count);
    const p = chain([readableFrom(makeInputs(n)), ...sectionFns, s]);
    s.on('finish', () => resolve(count));
    p.on('error', reject);
  });

function* items1to1(n) {
  for (let i = 0; i < n; ++i) yield pool[i & (POOL - 1)];
}

const FANOUT = 100;
function* itemsFanout(n) {
  const k = Math.ceil(n / FANOUT);
  for (let i = 0; i < k; ++i) yield i;
}
const fanoutFn = i => {
  const s = (i * 7) % (POOL - FANOUT);
  return chain.many(pool.slice(s, s + FANOUT));
};

export default {
  // single-fn group -> plain-fn path (where the processInput isMany guard lives)
  identity: n => run(n, items1to1, [x => x]),
  fanout: n => run(n, itemsFanout, [fanoutFn]),
  // multi-fn group -> applyFns path (unchanged by the batching work; control)
  'gen-2fn': n => run(n, items1to1, [x => x, x => x])
};
