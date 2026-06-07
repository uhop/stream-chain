// pipeline() / compose() vs chain() — Node-interop perf + ergonomics comparison.
//
// Quantifies the gap the author weighed when deciding whether to drop
// stream-chain for Node's own composition tools (stream.pipeline / stream.compose).
//
// Same logical pipeline in every case: a source yielding 1..n, then five numeric
// transforms whose net effect is the identity (so every case returns
// sum(1..n) = n*(n+1)/2 — a built-in correctness check), then the output summed.
// The transform work and the number of function calls (five) are identical across
// cases; only the *packaging* differs. Every "a tool composes the functions" case
// feeds the five fns as five separate stages — the tool does the composing; no case
// hands a tool a single hand-fused stage (that would credit the tool with a merge
// it didn't perform).
//
//   chain (merged)        five plain fns — chain fuses them into one stage
//   chain (stage per fn)  five fns each wrapped as its own stream stage
//   chain (Transform/fn)  the same five Transforms pipeline uses, driven by chain
//   pipeline (Transform)  one objectMode Transform per fn (five stages)
//   pipeline (async-gen)  one async-generator stage per fn (five stages)
//   compose (Transform)   the same five Transforms fused via stream.compose
//   gen / raw / plain loop stream-free baselines (no Duplex / no framework)
//
// Consumption is async iteration (and an async sink that iterates for the pipeline
// cases), EXCEPT `chain — terminal fn`, which accumulates inside the chain and emits
// nothing — included because the drain method is itself a large factor (measured in
// full in bench/consume/).
//
// n = items per run (per-item throughput); see RESULTS.md.

import {compose, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import chain, {asStream, none} from 'stream-chain';
import gen from 'stream-chain/gen.js';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

const makeTransform = f =>
  new Transform({
    objectMode: true,
    transform(chunk, _enc, cb) {
      cb(null, f(chunk));
    }
  });

// One async-gen stage per fn — pipeline()/compose() composing the five functions
// themselves, the cheapest way (no Transform objects). The tool does the merging.
const oneFn = f =>
  async function* (src) {
    for await (const x of src) yield f(x);
  };

const sum = async stream => {
  let acc = 0;
  for await (const x of stream) acc += x;
  return acc;
};

export default {
  async ['chain() — plain fns (merged)'](n) {
    const pipe = chain([source, ...fns]);
    pipe.end(n);
    return sum(pipe);
  },

  async ['chain() — terminal fn (sink inside)'](n) {
    let acc = 0;
    const pipe = chain([
      source,
      ...fns,
      x => {
        acc += x;
        return none;
      }
    ]);
    const done = new Promise((resolve, reject) => {
      pipe.on('end', resolve);
      pipe.on('error', reject);
    });
    pipe.resume();
    pipe.end(n);
    await done;
    return acc;
  },

  async ['chain() — stage per fn'](n) {
    const pipe = chain([source, ...fns.map(f => asStream(gen(f)))]);
    pipe.end(n);
    return sum(pipe);
  },

  // The same five bare Transforms that `pipeline() — Transform per fn` uses, but
  // driven by chain — isolates the orchestrator (chain vs pipeline) with identical
  // per-stage cost. This is "do exactly what pipeline does, in chain."
  async ['chain() — Transform per fn'](n) {
    const pipe = chain([source, ...fns.map(makeTransform)]);
    pipe.end(n);
    return sum(pipe);
  },

  // stream-chain's stream-free path (no Duplex) — what you reach for when you DON'T
  // need a stream.
  async ['gen() — stream-free (no Duplex)'](n) {
    const g = gen(source, ...fns);
    return sum(g(n));
  },

  async ['pipeline() — Transform per fn'](n) {
    let acc = 0;
    await pipeline(source(n), ...fns.map(makeTransform), async function (src) {
      for await (const x of src) acc += x;
    });
    return acc;
  },

  async ['pipeline() — async-gen per fn'](n) {
    let acc = 0;
    await pipeline(source(n), ...fns.map(oneFn), async function (src) {
      for await (const x of src) acc += x;
    });
    return acc;
  },

  async ['compose() — Transform per fn'](n) {
    return sum(compose(source(n), ...fns.map(makeTransform)));
  },

  // Stream-free async floor: one hand-written async generator, no framework. (A
  // person writing it by hand naturally fuses the fns into one loop — that's the
  // point of the baseline, and it is labeled as such, not as a tool's output.)
  async ['raw async generator'](n) {
    const g = async function* (src) {
      for await (const x of src) {
        let v = x;
        for (const f of fns) v = f(v);
        yield v;
      }
    };
    return sum(g(source(n)));
  },

  // The honest floor: no framework, no streams, no async — just a loop, same five
  // fn calls per item. This is what every case above competes with when the data is
  // in memory and there is no I/O. The streaming tools earn their keep on I/O,
  // backpressure, and unbounded data — none of which is here.
  ['plain loop (no framework)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      let v = i;
      for (const f of fns) v = f(v);
      acc += v;
    }
    return acc;
  }
};
