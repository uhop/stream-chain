// Regression gate: BOUNDED LIVE ALLOCATION when a single many() backpressures
// from its first element.
//
// The bug (fixed in src/exec.js): once a push backpressured, exec.nextMany
// allocated one closure + one `.then` promise PER REMAINING element — live
// allocation O(N) in the many() length. stream-json emits one many([all tokens
// for this buffer]) per chunk, so N grew with chunk size; a whole-document-in-
// one-chunk read exploded into O(N) live promises and ~36% GC. The fix (a
// resumable `step`, mirroring nextGen) allocates one closure PER ACTUAL
// SUSPENSION → O(1) in N.
//
// This is an ALLOCATION regression, invisible to the output-correctness suite
// (output is byte-identical). So we measure it directly: feed `exec.next` a
// single many([...N]) into a push that backpressures from element 0 (returns a
// never-resolving promise, PINNED — as a real stream pins its drain promise),
// and read heapUsed growth across the synchronous build phase. The eager build
// leaves the whole O(N) chain live; the resumable build leaves one suspension.
//
// CONTROL: the old eager-chain nextMany, inlined below. It MUST grow ~O(N),
// proving the bounded assertion on the real `next` has teeth (isn't passing
// vacuously because, say, the harness collected the chain).
//
// Run: node --expose-gc bench/json-exec/correctness/bounded-alloc.js

import {next} from 'stream-chain/exec.js';
import {many, none, isMany, getManyValues} from 'stream-chain/defs.js';

if (typeof globalThis.gc !== 'function') {
  console.error(
    'Run with --expose-gc:  node --expose-gc bench/json-exec/correctness/bounded-alloc.js'
  );
  process.exit(2);
}

const isThenable = v => v && typeof v.then === 'function';

// CONTROL — old eager-chain executor (pre-fix), minimal. Handles only what this
// scenario exercises: plain values threaded through an empty fn-list and pushed,
// with the buggy many() fan-out (one .then closure per remaining element).
const oldNext = (value, fns, i, push) => {
  for (;;) {
    if (isThenable(value)) return value.then(v => oldNext(v, fns, i, push));
    if (value == null || value === none) return;
    if (isMany(value)) return oldNextMany(getManyValues(value), fns, i, push);
    if (i >= fns.length) return push(value);
    value = fns[i++](value);
  }
};
const oldNextMany = (values, fns, i, push) => {
  let pending;
  for (let j = 0; j < values.length; ++j) {
    if (pending) {
      const jj = j;
      pending = pending.then(() => oldNext(values[jj], fns, i, push));
    } else {
      const r = oldNext(values[j], fns, i, push);
      if (isThenable(r)) pending = r;
    }
  }
  return pending;
};

const fns = []; // identity fn-list: every element falls straight through to push

// A push that always backpressures. Pin each returned promise — a real stream
// holds its drain promise until drain, which is exactly what keeps the chain
// (whether O(1) or O(N)) live. Without pinning the root, GC could reclaim it and
// the measurement would lie.
const measure = (drive, N) => {
  const values = new Array(N);
  for (let k = 0; k < N; ++k) values[k] = k;
  const roots = [];
  const push = () => {
    const p = new Promise(() => {});
    roots.push(p);
    return p;
  };

  globalThis.gc();
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const tail = drive(many(values), fns, 0, push); // returns the live pending chain
  const after = process.memoryUsage().heapUsed;

  // Keep everything reachable across the `after` read, then return the delta.
  if (!isThenable(tail) || roots.length !== 1) {
    throw Error(`expected one suspension root and a pending tail (got roots=${roots.length})`);
  }
  return after - before;
};

const mb = bytes => (bytes / (1024 * 1024)).toFixed(2);
const Ns = [1e4, 1e5, 1e6];
const MAX_N = Ns[Ns.length - 1];

const NEW_BOUND = 4 * 1024 * 1024; // generous: true O(1) is KB; allow 4 MB of noise
const CONTROL_FACTOR = 10; // control must allocate ≥ 10× the new build at MAX_N

console.log('single many([...N]) backpressuring from element 0; heapUsed delta:\n');
console.log('       N        new (src)      old (control)');

let newAtMax = 0,
  oldAtMax = 0;
for (const N of Ns) {
  const dNew = measure(next, N);
  const dOld = measure(oldNext, N);
  if (N === MAX_N) {
    newAtMax = dNew;
    oldAtMax = dOld;
  }
  console.log(
    `${String(N).padStart(9)}   ${(mb(dNew) + ' MB').padStart(12)}   ${(mb(dOld) + ' MB').padStart(12)}`
  );
}

const newFlat = newAtMax <= NEW_BOUND;
const controlSwells = oldAtMax >= CONTROL_FACTOR * Math.max(newAtMax, 64 * 1024);
const pass = newFlat && controlSwells;

console.log('');
console.log(
  `${newFlat ? 'PASS' : 'FAIL'}  new build bounded at N=${MAX_N}: ${mb(newAtMax)} MB ≤ ${mb(NEW_BOUND)} MB`
);
console.log(
  `${controlSwells ? 'PASS' : 'FAIL'}  control swells (teeth): old ${mb(oldAtMax)} MB ≥ ${CONTROL_FACTOR}× new`
);
console.log(`\n${pass ? 'ALL PASS' : 'FAILURES PRESENT'}`);
if (!pass) process.exit(1);
