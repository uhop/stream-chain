// Async variant of chain-vs-builtins.js: every one of the five transforms is now an
// `async` function (returns a Promise). Same identity composition, same checksum
// (sum(1..n) = n*(n+1)/2). This removes chain's sync-when-possible advantage — the
// executor must `await` each fn per item — so it shows what's left once every path
// pays a per-item await. Compare side-by-side with the sync RESULTS.md.
//
// As in the sync file, every "a tool composes the fns" case feeds five separate
// stages; no case hands a tool a pre-fused stage.
//
// n = items per run (per-item throughput); see RESULTS.md.

import {compose, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import chain, {asStream, none} from 'stream-chain';
import gen from 'stream-chain/gen.js';

const fns = [
  async x => x - 2,
  async x => x + 1,
  async x => 2 * x,
  async x => x + 2,
  async x => x >> 1
];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

const makeTransform = f =>
  new Transform({
    objectMode: true,
    transform(chunk, _enc, cb) {
      f(chunk).then(r => cb(null, r), cb);
    }
  });

// One async-gen stage per fn — the tool composes the five fns itself.
const oneFn = f =>
  async function* (src) {
    for await (const x of src) yield await f(x);
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

  async ['chain() — Transform per fn'](n) {
    const pipe = chain([source, ...fns.map(makeTransform)]);
    pipe.end(n);
    return sum(pipe);
  },

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

  // Stream-free async floor: one hand-written async generator, awaiting each fn.
  async ['raw async generator'](n) {
    const g = async function* (src) {
      for await (const x of src) {
        let v = x;
        for (const f of fns) v = await f(v);
        yield v;
      }
    };
    return sum(g(source(n)));
  },

  // The floor with async fns: a plain loop is now async too (one await per fn).
  async ['plain async loop (no framework)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      let v = i;
      for (const f of fns) v = await f(v);
      acc += v;
    }
    return acc;
  }
};
