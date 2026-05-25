// Does SHARING one exec.next across many consumers degrade its `push(...)` call
// site to megamorphic — vs each consumer having its own copy (monomorphic push)?
// This is the share-vs-inline question made concrete.
//
//   shared:  ONE dispatch instance, driven with 5 DISTINCT push fns  → push site sees 5 shapes (megamorphic)
//   inlined: 5 dispatch instances, each driven with ONE push fn      → each push site sees 1 shape (monomorphic)
//
// Same total work (same records, same 5 push fns, same outputs); the only
// variable is the inline-cache state of the `push(value)` site inside dispatch.
// makeDispatch() returns a fresh closure cluster, so each instance has its own
// feedback vector / ICs. Pipeline copied inline.

import * as defs from 'stream-chain/defs.js';

const TOKENS = 32;
const tokenize = r => {
  const a = new Array(TOKENS);
  for (let i = 0; i < TOKENS; ++i)
    a[i] = {name: i & 1 ? 'value' : 'key', value: (r * 2654435761 + i) >>> 0};
  return defs.many(a);
};
const pick = t => (t.name === 'value' ? t : defs.none);
const assemble = t => ({v: t.value & 0xffff});
const keep = o => (o.v & 1 ? o : defs.none);
const emit = o => o.v;
const fns = [tokenize, pick, assemble, keep, emit];

// fresh dispatch cluster per call → independent inline caches at `push(...)`
const makeDispatch = () => {
  const next = (value, fns, index, push) => {
    for (let i = index; ; ) {
      if (value && typeof value.then == 'function') {
        const ii = i;
        return value.then(v => next(v, fns, ii, push));
      }
      if (value == null || value === defs.none) return;
      if (value === defs.stop) throw new defs.Stop();
      if (defs.isFinalValue(value)) return push(defs.getFinalValue(value));
      if (defs.isMany(value)) return nextMany(defs.getManyValues(value), fns, i, push);
      if (value && typeof value.next == 'function') return nextGen(value, fns, i, push);
      if (i >= fns.length) return push(value);
      value = fns[i++](value);
    }
  };
  const nextMany = (values, fns, i, push) => {
    let pending;
    for (let j = 0; j < values.length; ++j) {
      if (pending) {
        const jj = j;
        pending = pending.then(() => next(values[jj], fns, i, push));
      } else {
        const r = next(values[j], fns, i, push);
        if (r && typeof r.then == 'function') pending = r;
      }
    }
    return pending;
  };
  const nextGen = (it, fns, i, push) => {
    const step = () => {
      for (;;) {
        let data = it.next();
        if (data && typeof data.then == 'function') {
          return data.then(d => {
            if (d.done) return;
            const r = next(d.value, fns, i, push);
            return r && typeof r.then == 'function' ? r.then(step) : step();
          });
        }
        if (data.done) return;
        const r = next(data.value, fns, i, push);
        if (r && typeof r.then == 'function') return r.then(step);
      }
    };
    return step();
  };
  return next;
};

let acc = 0;
// 5 DISTINCT function literals (distinct SFIs) → 5 callee shapes at a shared site
const p0 = v => void (acc += v);
const p1 = v => void (acc += v);
const p2 = v => void (acc += v);
const p3 = v => void (acc += v);
const p4 = v => void (acc += v);
const pushes = [p0, p1, p2, p3, p4];

const sharedNext = makeDispatch();
const nexts = Array.from({length: 5}, () => makeDispatch());

export default {
  shared(n) {
    acc = 0;
    for (let i = 1; i <= n; ++i) sharedNext(i, fns, 0, pushes[i % 5]);
    return acc;
  },
  inlined(n) {
    acc = 0;
    for (let i = 1; i <= n; ++i) {
      const c = i % 5;
      nexts[c](i, fns, 0, pushes[c]);
    }
    return acc;
  }
};
