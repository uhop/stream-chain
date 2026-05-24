// Same thing, three ways: run one JSON-like token pipeline over n records
// IN-PROCESS (no stream machinery) and sum the emitted values. Compares the
// three core executors — fun.next, gen.next, and the prototype value-or-promise
// exec — on identical work. Isolates executor cost from Duplex/backpressure.
//
// Pipeline (copied inline — bench files don't share definitions):
//   record ──tokenize──▶ many(32 tokens) ─pick(drop)─ assemble ─keep(drop)─ emit
//
// The many() fan-out at a non-terminal stage is what makes the executor's
// per-item handling matter.

import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import {many, none, getManyValues} from 'stream-chain/defs.js';
import exec from './exec.js';

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

const g = gen(...fns),
  f = fun(...fns);

export default {
  async fun(n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for (const x of getManyValues(await f(i))) acc += x;
    }
    return acc;
  },

  async gen(n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for await (const x of g(i)) acc += x;
    }
    return acc;
  },

  async exec(n) {
    let acc = 0;
    const push = x => void (acc += x); // sync sink — never returns a promise
    for (let i = 1; i <= n; ++i) exec(i, fns, 0, push);
    return acc;
  }
};
