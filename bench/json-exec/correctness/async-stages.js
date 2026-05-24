// Correctness gate: genuinely-async stages produce IDENTICAL output under exec
// vs applyFns. exec stays synchronous until the first real promise, then chains
// via .then — these cases force that transition (a thenable-returning fn, an
// async fn, an async generator) and check it threads results correctly,
// including async stages downstream of a many() fan-out.
//
// Run: node bench/json-exec/correctness/async-stages.js

import chain, {asStream} from 'stream-chain';
import gen from 'stream-chain/gen.js';
import {many} from 'stream-chain/defs.js';
import asStreamExec from '../asStream-exec.js';

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
  'thenable fn': {fns: () => [x => Promise.resolve(x + 1)], M: 5},
  'async fn': {fns: () => [async x => x * 2], M: 5},
  'async generator': {
    fns: () => [
      async function* (x) {
        yield x;
        yield x * 10;
      }
    ],
    M: 3
  },
  'many → async fn': {fns: () => [x => many([x, x + 1]), async x => x * 2], M: 4},
  'async fn → many': {
    fns: () => [async x => x, x => many([x, x + 100])],
    M: 4
  },
  'mixed sync/async/gen': {
    fns: () => [
      x => x + 1,
      async x => x * 2,
      function* (x) {
        yield x;
        yield x + 1;
      },
      async x => x - 1
    ],
    M: 4
  }
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
