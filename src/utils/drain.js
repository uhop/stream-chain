// @ts-self-types="./drain.d.ts"

// Drains an async iterable, returning its last yielded value (or `undefined`
// if it yielded nothing). The standard way to run a `gen([…])(value)` pipeline
// whose output you don't otherwise want: sink-terminated chains
// (e.g. `gen([…, asyncBlockWriter(path)])`) yield nothing and resolve to
// `undefined`; single-final-value termini (an assembler-style stage that
// yields once) come through as the resolved value. A `pipe()` run's `Stop` ends the
// drain; any other `Stop` propagates.

import {isStop} from '../defs.js';
import {pipeRunSymbol} from '../exec.js';

const drain = async g => {
  let last;
  try {
    for await (const v of g) last = v;
  } catch (error) {
    // a pipe() run has nothing more to feed; a gen() run's caller needs the Stop
    if (isStop(error) && g[pipeRunSymbol]) return last;
    throw error;
  }
  return last;
};

export default drain;
export {drain};
