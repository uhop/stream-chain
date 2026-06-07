// Output consumption on Node — does a terminal function (accumulate INSIDE the
// chain, emit nothing) beat reading the output via .on('data') or `for await`?
//
// Upstream is identical in every case: chain([source, ...fns]) producing 1..n
// (the five fns net to the identity). Only how the output is consumed differs.
// The terminal-function case appends one more plain fn that returns `none`, so
// it merges into the same fused segment and the readable side carries no values
// at all — no per-item event dispatch or async-iterator handoff. Every case
// returns sum(1..n) = n*(n+1)/2.
//
// n = items per run; see RESULTS.md.

import chain, {none} from 'stream-chain';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const source = function* (n) {
  for (let i = 1; i <= n; ++i) yield i;
};

const onEnd = pipe =>
  new Promise((resolve, reject) => {
    pipe.on('end', resolve);
    pipe.on('error', reject);
  });

export default {
  async ['terminal function'](n) {
    let acc = 0;
    const pipe = chain([
      source,
      ...fns,
      x => {
        acc += x;
        return none;
      }
    ]);
    const done = onEnd(pipe);
    pipe.resume(); // flowing mode drains the (empty) output through to 'end'
    pipe.end(n);
    await done;
    return acc;
  },

  async ["on('data')"](n) {
    let acc = 0;
    const pipe = chain([source, ...fns]);
    pipe.on('data', x => (acc += x));
    const done = onEnd(pipe);
    pipe.end(n);
    await done;
    return acc;
  },

  async ['for await...of'](n) {
    let acc = 0;
    const pipe = chain([source, ...fns]);
    pipe.end(n);
    for await (const x of pipe) acc += x;
    return acc;
  }
};
