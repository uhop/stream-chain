// Correctness gate: BOUNDED QUEUE under an unbounded burst + backpressure.
//
// The async `applyFns` was written to fix three "swelling vectors" — places
// where one input expands to K outputs and the old flag-checked-once executor
// pushed all K while checking backpressure only once, swelling the queue
// without bound. The value-or-promise `exec` must suspend AT the push instead.
//
// Method: write ONE chunk that fans out to K items, never read, and watch the
// readable buffer. Correct backpressure caps it at the high-water mark; a
// swelling executor pushes all K. A deliberately-broken `naive` executor is
// included as a CONTROL — it must visibly swell, proving the assertion has
// teeth (isn't passing vacuously).
//
// Run: node bench/json-exec/correctness/backpressure.js

import {Duplex} from 'node:stream';
import {asStream} from 'stream-chain';
import gen from 'stream-chain/gen.js';
import {many, none, isMany, getManyValues} from 'stream-chain/defs.js';
import asStreamExec from '../asStream-exec.js';

const K = 5000; // >> objectMode default high-water mark (16)

// CONTROL: minimal asStream whose executor ignores push()'s backpressure return
// (the old swelling bug). Must blow the buffer up to ~K.
const asStreamNaive = fnList => {
  const innerFns = fnList.fList;
  let stream;
  const push = v => void stream.push(v); // ignores push() === false
  const burst = (value, i) => {
    for (;;) {
      if (value == null || value === none) return;
      if (isMany(value)) {
        for (const v of getManyValues(value)) burst(v, i);
        return;
      }
      if (value && typeof value.next === 'function') {
        for (const v of value) burst(v, i);
        return;
      }
      if (i >= innerFns.length) return push(value);
      value = innerFns[i++](value);
    }
  };
  stream = new Duplex({
    writableObjectMode: true,
    readableObjectMode: true,
    write(chunk, _enc, cb) {
      burst(chunk, 0);
      cb(null);
    },
    final(cb) {
      stream.push(null);
      cb(null);
    },
    read() {}
  });
  return stream;
};

// peak readable buffer while writing ONE chunk and NOT reading
const peakBuffer = async (makeStream, fns, input) => {
  const s = makeStream(gen(...fns));
  s.on('error', () => {}); // swallow destroy() abort noise
  s.write(input);
  let peak = 0;
  for (let t = 0; t < 4; ++t) {
    await new Promise(r => setImmediate(r));
    if (s.readableLength > peak) peak = s.readableLength;
  }
  const hwm = s.readableHighWaterMark;
  s.destroy();
  return {peak, hwm};
};

// full drain — output count must equal K
const drainCount = (makeStream, fns, input) =>
  new Promise((resolve, reject) => {
    const s = makeStream(gen(...fns));
    let count = 0;
    s.on('data', () => ++count);
    s.on('end', () => resolve(count));
    s.on('error', reject);
    s.write(input);
    s.end();
  });

const vectors = {
  'many-at-end': [x => many(Array.from({length: K}, (_, i) => x + i))],
  'many-mid-chain': [x => many(Array.from({length: K}, (_, i) => x + i)), y => y + 1],
  'generator-yields': [
    function* (x) {
      for (let i = 0; i < K; ++i) yield x + i;
    }
  ]
};

const main = async () => {
  let allPass = true;
  console.log(`K=${K} per input; objectMode hwm=16. Bounded ⟺ peak ≈ hwm.\n`);
  for (const [name, fns] of Object.entries(vectors)) {
    const cur = await peakBuffer(asStream, fns, 0);
    const nw = await peakBuffer(asStreamExec, fns, 0);
    const naive = await peakBuffer(asStreamNaive, fns, 0);
    const bound = 2 * cur.hwm;

    const curCount = await drainCount(asStream, fns, 0);
    const newCount = await drainCount(asStreamExec, fns, 0);

    const boundedOk = cur.peak <= bound && nw.peak <= bound;
    const controlOk = naive.peak >= K / 2; // control must swell
    const countOk = curCount === K && newCount === K;
    const pass = boundedOk && controlOk && countOk;
    allPass &&= pass;

    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
    console.log(
      `      peak buffer — applyFns:${cur.peak}  exec:${nw.peak}  naive(control):${naive.peak}  (bound ${bound})`
    );
    console.log(`      output count — applyFns:${curCount}  exec:${newCount}  (expect ${K})`);
  }
  console.log(`\n${allPass ? 'ALL PASS' : 'FAILURES PRESENT'}`);
  if (!allPass) process.exit(1);
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
