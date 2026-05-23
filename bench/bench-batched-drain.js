// Benchmark: per-item drain cost through the real chain() path, baseline vs.
// transport batching (chain({batch:N}) + a batched() consumer).
//
// Run (from repo root):
//   npx nano-bench -i 200000 -s 60 bench/bench-batched-drain.js          # node
//   bun  `npx nano-bench --self` -i 200000 -s 60 bench/bench-batched-drain.js
//   deno run -A `npx nano-bench --self` -i 200000 -s 60 bench/bench-batched-drain.js
//
// `n` = number of object-mode items drained per sample. nano-bench normalizes
// to per-item (op/s ≈ items/sec at batch=n). A large fixed level (-i 200000)
// amortizes pipeline setup over the drain. See
// projects/stream-chain/design/batched-drain.md and bench/RESULTS.md.

import chain from '../src/index.js';
import readableFrom from '../src/utils/readableFrom.js';
import {Writable} from 'node:stream';
import {batched, isMany, getManyValues} from '../src/defs.js';

// Representative small token-like object (stream-json SAX shape).
const POOL_BITS = 12;
const POOL = 1 << POOL_BITS; // 4096
const pool = Array.from({length: POOL}, (_, i) => ({name: 'numberValue', value: String(i)}));

// Object-mode sink counting individual items. A batched() sink unbundles
// many() itself (the batched() contract), so the count stays faithful — the
// batch is invisible to the item-level work, a true drop-in.
const makeSink = (onItem, batchedSink) => {
  const w = new Writable({
    objectMode: true,
    write(chunk, _enc, cb) {
      if (isMany(chunk)) {
        const v = getManyValues(chunk);
        for (let i = 0; i < v.length; ++i) onItem();
      } else {
        onItem();
      }
      cb();
    }
  });
  return batchedSink ? batched(w) : w;
};

// Drain into a sink; resolve when the whole pipeline finishes.
const runSink = (n, makeInputs, sectionFns, options, batchedSink) =>
  new Promise((resolve, reject) => {
    let count = 0;
    const sink = makeSink(() => ++count, batchedSink);
    const pipeline = chain([readableFrom(makeInputs(n)), ...sectionFns, sink], options);
    sink.on('finish', () => resolve(count));
    pipeline.on('error', reject);
  });

// Read the chain's own output (the `for await` shape), counting items and
// unbundling many() chunks when batchOutput delivers them.
const runRead = (n, makeInputs, sectionFns, options) =>
  new Promise((resolve, reject) => {
    let count = 0;
    const pipeline = chain([readableFrom(makeInputs(n)), ...sectionFns], options);
    pipeline.on('data', chunk => (count += isMany(chunk) ? getManyValues(chunk).length : 1));
    pipeline.on('end', () => resolve(count));
    pipeline.on('error', reject);
  });

// n plain items, 1:1 through the section.
function* items1to1(n) {
  for (let i = 0; i < n; ++i) yield pool[i & (POOL - 1)];
}

// n/K inputs, each fanned out to K items via many() — mirrors a parser emitting
// many tokens per read. The section unbundles the input many() and re-drains.
const FANOUT = 100;
function* itemsFanout(n) {
  const inputs = Math.ceil(n / FANOUT);
  for (let i = 0; i < inputs; ++i) yield i;
}
const fanoutFn = i => {
  const start = (i * 7) % (POOL - FANOUT);
  return chain.many(pool.slice(start, start + FANOUT));
};

const PER_ITEM = {batch: 1}; // disables batching — today's path
const BATCHED = {batch: 1000};

export default {
  // 1:1 section → sink.
  'identity per-item': n => runSink(n, items1to1, [x => x], PER_ITEM, false),
  'identity batched': n => runSink(n, items1to1, [x => x], BATCHED, true),

  // 1:K fan-out section → sink (the parser shape).
  'fanout per-item': n => runSink(n, itemsFanout, [fanoutFn], PER_ITEM, false),
  'fanout batched': n => runSink(n, itemsFanout, [fanoutFn], BATCHED, true),

  // Reading the chain's own output (`for await`): per-item vs. batchOutput.
  'fanout-out per-item': n => runRead(n, itemsFanout, [fanoutFn], PER_ITEM),
  'fanout-out batchOutput': n =>
    runRead(n, itemsFanout, [fanoutFn], {batch: 1000, batchOutput: true})
};
