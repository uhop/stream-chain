// Q: can fun() be rebuilt on the exec engine without a perf cost? `exec.next`
// generalizes `fun.next` — drive it with an array-appending push that never
// backpressures and it behaves exactly like fun.next; wrap the array in many()
// and you have fun(). This compares the real fun() against that "fun via exec"
// on the same in-process JSON-like pipeline. If they're equal, the two engines
// could unify (one `next` for fun/asStream).
//
// Same thing, two ways; pipeline copied inline.
//   record ──tokenize──▶ many(32) ─pick─ assemble ─keep─ emit

import fun from 'stream-chain/fun.js';
import {many, none, getManyValues} from 'stream-chain/defs.js';
import {next} from '../../src/exec.js';

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

const f = fun(...fns);

// fun-like on exec.next: collect into an array, return many. The push never
// returns a promise, so next() stays fully synchronous — fun.next's behavior.
const funViaExec = value => {
  const out = [];
  const r = next(value, fns, 0, v => void out.push(v));
  if (r && typeof r.then == 'function') return r.then(() => many(out));
  return many(out);
};

export default {
  async fun(n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for (const x of getManyValues(await f(i))) acc += x;
    }
    return acc;
  },

  async ['fun via exec'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for (const x of getManyValues(await funViaExec(i))) acc += x;
    }
    return acc;
  }
};
