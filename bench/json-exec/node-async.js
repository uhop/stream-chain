// Regression check: same JSON-like pipeline as node.js, but the `keep` stage is
// genuinely ASYNC (awaits per surviving token). This is exec's worst case — it
// must go async at `keep` for every survivor, so its value-or-promise
// .then-chaining competes directly with applyFns's native `await`. If exec is
// within noise or faster here, the optimization carries no penalty on async
// pipelines; if it's notably slower, that's a real regression for async use.
//
// Same thing, two ways (applyFns vs exec); pipeline copied inline.
//   record ──tokenize──▶ many(32) ─pick─ assemble ─[async keep]─ emit

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
const keep = async obj => (obj.v & 1 ? obj : none); // ← async: awaits per survivor
const emit = obj => obj.v;

const fns = [tokenize, pick, assemble, keep, emit];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

const run = (makeStage, n) =>
  new Promise((resolve, reject) => {
    let acc = 0;
    const pipe = chain([source, makeStage(gen(...fns))]);
    pipe.on('data', x => (acc += x));
    pipe.on('end', () => resolve(acc));
    pipe.on('error', reject);
    pipe.end(n);
  });

export default {
  ['applyFns (current)'](n) {
    return run(asStream, n);
  },
  ['exec (new)'](n) {
    return run(asStreamExec, n);
  }
};
