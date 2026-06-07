// Does a plain sync function with none/many() pay off vs a synchronous generator for
// a 1 -> 0..N transform, and how does the answer move with fan-out? Sweeps fan-out
// 1 / 4 / 16. Isolates the functional mechanics: in-process drivers only (fun =
// sync-first, gen = async-iterable), NO stream machinery, trivial per-output work
// (copies of x), so none/many vs yield/iterate dominates, not the processing.
//
// Each input: even -> none (0 outputs), odd -> K copies. At K=1 the function form is
// the idiomatic bare value return (no many wrapper); at K>=2 it returns many([...K]).
// Checksum = (sum of odd 1..n) * K = 250000 * K at n=1000.
//
//   function form (K=1):   x => x & 1 ? x : none
//   function form (K>=2):  x => x & 1 ? many(Array(K).fill(x)) : none
//   generator form:        function*(x){ if (x & 1) for K: yield x }
//
// n = inputs per run (per-input throughput; each input fans out to 0 or K).

import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import {many, none, getManyValues} from 'stream-chain';

const fnProducer = K =>
  K === 1 ? x => (x & 1 ? x : none) : x => (x & 1 ? many(Array(K).fill(x)) : none);

const genProducer = K =>
  function* (x) {
    if (x & 1) for (let j = 0; j < K; ++j) yield x;
  };

const runFun = (producer, n) => {
  const f = fun(producer);
  let acc = 0;
  for (let i = 1; i <= n; ++i) for (const v of getManyValues(f(i))) acc += v;
  return acc;
};

const runGen = async (producer, n) => {
  const g = gen(producer);
  let acc = 0;
  for (let i = 1; i <= n; ++i) for await (const v of g(i)) acc += v;
  return acc;
};

export default {
  ['fun + fn  ×1'](n) {
    return runFun(fnProducer(1), n);
  },
  ['fun + gen ×1'](n) {
    return runFun(genProducer(1), n);
  },
  ['fun + fn  ×4'](n) {
    return runFun(fnProducer(4), n);
  },
  ['fun + gen ×4'](n) {
    return runFun(genProducer(4), n);
  },
  ['fun + fn  ×16'](n) {
    return runFun(fnProducer(16), n);
  },
  ['fun + gen ×16'](n) {
    return runFun(genProducer(16), n);
  },
  async ['gen + fn  ×1'](n) {
    return runGen(fnProducer(1), n);
  },
  async ['gen + gen ×1'](n) {
    return runGen(genProducer(1), n);
  },
  async ['gen + fn  ×4'](n) {
    return runGen(fnProducer(4), n);
  },
  async ['gen + gen ×4'](n) {
    return runGen(genProducer(4), n);
  },
  async ['gen + fn  ×16'](n) {
    return runGen(fnProducer(16), n);
  },
  async ['gen + gen ×16'](n) {
    return runGen(genProducer(16), n);
  }
};
