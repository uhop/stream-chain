// Same thing, two ways: the SAME JSON-like token pipeline through the SAME Node
// Duplex chain — once with the real asStream (current `async applyFns`), once
// with asStream-exec (prototype value-or-promise `exec`). Only the executor
// differs; source, fn-list, Duplex wiring, and backpressure are identical, so
// the delta is purely the executor swap. This is the decision benchmark.
//
// Pipeline (copied inline — bench files don't share definitions):
//   record ──tokenize──▶ many(32 tokens) ─pick(drop)─ assemble ─keep(drop)─ emit

import gen from 'stream-chain/gen.js';
import {many, none} from 'stream-chain/defs.js';
import chain, {asStream} from 'stream-chain';
import asStreamExec from './asStream-exec.js';

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

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

// drain a chain Duplex to completion; resolve on 'end' (readable drained), not
// 'finish' (writable done) — many() bursts make the readable lag the writable.
const drain = pipe =>
  new Promise((resolve, reject) => {
    let acc = 0;
    pipe.on('data', x => (acc += x));
    pipe.on('end', () => resolve(acc));
    pipe.on('error', reject);
  });

export default {
  async ['applyFns (current)'](n) {
    const pipe = chain([source, asStream(gen(...fns))]);
    const done = drain(pipe);
    pipe.end(n);
    return done;
  },

  async ['exec (new)'](n) {
    const pipe = chain([source, asStreamExec(gen(...fns))]);
    const done = drain(pipe);
    pipe.end(n);
    return done;
  }
};
