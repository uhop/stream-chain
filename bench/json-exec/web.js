// Same thing, two ways: the SAME JSON-like token pipeline through the SAME Web
// Streams chain — once with the real asWebStream (current `async applyFns`),
// once with asWebStream-exec (prototype value-or-promise `exec`). Only the
// executor differs. The Web counterpart of node.js — settles whether the
// executor swap is a Node-only win or applies on Web too.
//
// Pipeline (copied inline — bench files don't share definitions):
//   record ──tokenize──▶ many(32 tokens) ─pick(drop)─ assemble ─keep(drop)─ emit

import gen from 'stream-chain/gen.js';
import {many, none} from 'stream-chain/defs.js';
import webChain, {asWebStream} from 'stream-chain/web';
import asWebStreamExec from './asWebStream-exec.js';

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

const run = async (makeStage, n) => {
  let acc = 0;
  const c = webChain([source, makeStage(gen(...fns))]);
  const writer = c.writable.getWriter();
  const writePromise = writer.write(n).then(() => writer.close());
  const reader = c.readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    acc += value;
  }
  await writePromise;
  return acc;
};

export default {
  ['applyFns (current)'](n) {
    return run(asWebStream, n);
  },
  ['exec (new)'](n) {
    return run(asWebStreamExec, n);
  }
};
