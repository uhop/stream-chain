// Prototype unified value-or-promise executor (bench-only — does not touch src/).
//
// Threads a value through fns[i..], pushing terminal values via `push`. Returns
// undefined when the whole thing ran synchronously (no backpressure, no async),
// or a Promise when it had to suspend. This is the key difference from
// asStream's `applyFns`, which is an `async function` and therefore allocates a
// frame + forces a microtask on EVERY recursive item even when nothing awaits.
//
// Duck-types returned values at runtime (the old fun() model): thenable → chain
// and resume; many() → expand; .next → iterate as a generator; none/null →
// drop; stop → throw Stop; finalValue → emit and short-circuit. An async
// generator is not special — it's just a generator whose next() returned a
// promise, handled by the same suspend-resume path.
//
// `push(value)` returns undefined (downstream queue not full) or a Promise that
// resolves on the next read (backpressure). Suspending AT the push is what
// preserves the bounded queue (the three swelling vectors).

import * as defs from 'stream-chain/defs.js';

const isThenable = v => v && typeof v.then === 'function';

const exec = (value, fns, i, push) => {
  for (;;) {
    if (isThenable(value)) {
      return value.then(v => exec(v, fns, i, push));
    }
    if (value == null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isFinalValue(value)) {
      return push(defs.getFinalValue(value)); // emit, bypass remaining fns
    }
    if (defs.isMany(value)) {
      return execMany(defs.getManyValues(value), fns, i, push);
    }
    if (value && typeof value.next === 'function') {
      return execGen(value, fns, i, push);
    }
    if (i >= fns.length) {
      return push(value); // terminal plain value
    }
    value = fns[i++](value);
  }
};

// Iterate a many() array, threading each element. Stay synchronous until one
// element returns a promise (a downstream backpressure push, or genuine async);
// then chain the remainder so we suspend mid-array instead of flooding push.
const execMany = (values, fns, i, push) => {
  let pending;
  for (let j = 0; j < values.length; ++j) {
    if (pending) {
      const jj = j;
      pending = pending.then(() => exec(values[jj], fns, i, push));
    } else {
      const r = exec(values[j], fns, i, push);
      if (isThenable(r)) pending = r;
    }
  }
  return pending;
};

// Iterate a generator, threading each yield. A resumable `step` keeps the loop
// synchronous for a sync generator with a draining queue; it goes async ONLY
// when next() returns a promise (async generator) or a yield's downstream push
// returns a backpressure promise — then resumes via .then(step).
const execGen = (it, fns, i, push) => {
  const step = () => {
    for (;;) {
      let data = it.next();
      if (isThenable(data)) {
        return data.then(d => {
          if (d.done) return;
          const r = exec(d.value, fns, i, push);
          return isThenable(r) ? r.then(step) : step();
        });
      }
      if (data.done) return;
      const r = exec(data.value, fns, i, push);
      if (isThenable(r)) return r.then(step);
    }
  };
  return step();
};

export default exec;
export {exec};
