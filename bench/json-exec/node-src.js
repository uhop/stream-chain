// Confirms the PROMOTED src/exec.js preserves the prototype's perf: same
// JSON-like pipeline as node.js, same Node Duplex, comparing the current
// `applyFns` against `src/exec.js`'s `next` (via asStream-src.js). If this
// matches node.js's ~35%, the perf carries over from bench prototype to src/.
//
//   record ──tokenize──▶ many(32) ─pick─ assemble ─keep─ emit

import gen from 'stream-chain/gen.js';
import {many, none} from 'stream-chain/defs.js';
import chain, {asStream} from 'stream-chain';
import asStreamSrc from './asStream-src.js';

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
  ['exec (src/exec.js)'](n) {
    return run(asStreamSrc, n);
  }
};
