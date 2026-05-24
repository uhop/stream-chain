// Correctness gate: Stop and flush produce IDENTICAL output under exec vs the
// current applyFns. These are the control-flow features the async executor
// handles for free (try/catch→rejection, final() flush loop); the
// value-or-promise exec must match them exactly.
//
// Run: node bench/json-exec/correctness/stop-flush.js

import chain, {asStream} from 'stream-chain';
import gen from 'stream-chain/gen.js';
import {many, none, stop, flushable} from 'stream-chain/defs.js';
import asStreamExec from '../asStream-exec.js';

// batching flushable: buffers, emits many() every n items, flushes remainder
// when called with none (asStream's final() passes none to flushables).
const batchBy = n => {
  let buf = [];
  return flushable(x => {
    if (x === none) {
      const out = buf;
      buf = [];
      return out.length ? many(out) : none;
    }
    buf.push(x);
    if (buf.length >= n) {
      const out = buf;
      buf = [];
      return many(out);
    }
    return none;
  });
};

// halts the stream after letting n items through
const stopAfter = n => {
  let c = 0;
  return x => (c++ < n ? x : stop);
};

const collect = (makeStage, fns, M) =>
  new Promise((resolve, reject) => {
    const out = [];
    const source = function* (n) {
      for (let i = 0; i < n; ++i) yield i;
    };
    const pipe = chain([source, makeStage(gen(...fns))]);
    pipe.on('data', x => out.push(x));
    pipe.on('end', () => resolve(out));
    pipe.on('error', reject);
    pipe.end(M);
  });

const cases = {
  'flush (batchBy 3, M=10)': {fns: () => [batchBy(3), x => x], M: 10},
  'flush remainder (batchBy 4, M=10)': {fns: () => [batchBy(4)], M: 10},
  'stop after 4 (M=10)': {fns: () => [stopAfter(4)], M: 10},
  'stop mid-many (M=5, fan-out 3)': {
    fns: () => [x => many([x, x, x]), stopAfter(7)],
    M: 5
  },
  'flush then stop': {fns: () => [batchBy(3), stopAfter(5)], M: 10}
};

const main = async () => {
  let allPass = true;
  for (const [name, {fns, M}] of Object.entries(cases)) {
    const cur = await collect(asStream, fns(), M);
    const nw = await collect(asStreamExec, fns(), M);
    const pass = JSON.stringify(cur) === JSON.stringify(nw);
    allPass &&= pass;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
    if (!pass) {
      console.log(`      applyFns: ${JSON.stringify(cur)}`);
      console.log(`      exec:     ${JSON.stringify(nw)}`);
    }
  }
  console.log(`\n${allPass ? 'ALL PASS' : 'FAILURES PRESENT'}`);
  if (!allPass) process.exit(1);
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
