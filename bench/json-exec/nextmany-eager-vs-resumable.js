// Fast-path perf check for the nextMany O(n) fix (src/exec.js).
//
// The fix made nextMany resumable (one closure per actual suspension instead of
// one per element). On the no-backpressure happy path that costs one extra
// `step` closure per nextMany CALL (per chunk/record), where the eager loop
// allocated none. This bench isolates that cost: identical in-process pipeline,
// run through the local prototype exec (eager nextMany — the pre-fix shape) vs
// stream-chain/exec.js (resumable — the shipped fix). A regression would show
// `resumable` measurably slower than `eager`. Both push synchronously (sink
// never backpressures), so every many(32) threads straight through.
//
// Run: npx nano-bench bench/json-exec/nextmany-eager-vs-resumable.js

import protoExec from './exec.js'; // local prototype: eager nextMany (pre-fix shape)
import {next as srcNext} from 'stream-chain/exec.js'; // shipped fix: resumable nextMany
import {many, none} from 'stream-chain/defs.js';

const TOKENS_PER_RECORD = 32;

const tokenize = record => {
  const tokens = new Array(TOKENS_PER_RECORD);
  for (let i = 0; i < TOKENS_PER_RECORD; ++i) {
    tokens[i] = {name: i & 1 ? 'value' : 'key', value: (record * 2654435761 + i) >>> 0};
  }
  return many(tokens);
};
const pick = token => (token.name === 'value' ? token : none);
const assemble = token => ({v: token.value & 0xffff});
const keep = obj => (obj.v & 1 ? obj : none);
const emit = obj => obj.v;

const fns = [tokenize, pick, assemble, keep, emit];

// The local prototype exec is called exec(value, fns, i, push); src's next has
// the same signature. Both return void on the fully-synchronous path here.
const run = drive => n => {
  let acc = 0;
  const push = x => void (acc += x); // sync sink — never returns a promise
  for (let i = 1; i <= n; ++i) drive(i, fns, 0, push);
  return acc;
};

export default {
  eager: run(protoExec),
  resumable: run(srcNext)
};
