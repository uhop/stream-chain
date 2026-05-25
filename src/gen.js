// @ts-self-types="./gen.d.ts"

import * as defs from './defs.js';
import {next as execNext, flush as execFlush} from './exec.js';

// Legacy async-generator trampoline, retained as `gen.next` for compatibility.
// gen() itself no longer uses it — its async generator is now a push→pull bridge
// over the shared executor (exec.next), which is ~45% faster because native
// async-generator delegation (`yield*`) instantiates a nested generator per
// many() element. See [[projects/stream-chain/design/sync-when-possible-executor]].
const next = async function* (value, fns, index) {
  for (let i = index; i <= fns.length; ++i) {
    if (value && typeof value.then == 'function') {
      // thenable
      value = await value;
    }
    if (value === defs.none) break;
    if (value === defs.stop) throw new defs.Stop();
    if (defs.isFinalValue(value)) {
      yield defs.getFinalValue(value);
      break;
    }
    if (defs.isMany(value)) {
      const values = defs.getManyValues(value);
      if (i == fns.length) {
        yield* values;
      } else {
        for (let j = 0; j < values.length; ++j) {
          yield* next(values[j], fns, i);
        }
      }
      break;
    }
    if (value && typeof value.next == 'function') {
      // generator
      for (;;) {
        let data = value.next();
        if (data && typeof data.then == 'function') {
          data = await data;
        }
        if (data.done) break;
        if (i == fns.length) {
          yield data.value;
        } else {
          yield* next(data.value, fns, i);
        }
      }
      break;
    }
    if (i == fns.length) {
      yield value;
      break;
    }
    const f = fns[i];
    value = f(value);
  }
};

const gen = (...fns) => {
  fns = fns
    .filter(fn => fn)
    .flat(Infinity)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  if (!fns.length) {
    fns = [x => x];
  }
  let flushed = false;

  // push→pull bridge: the shared executor drives the producer (exec.next, or
  // exec.flush on `none`); each push parks on a promise the consumer resolves
  // when it pulls the next value, so production stays one item ahead (bounded).
  // A for-await `break` runs .return() → the finally rejects the parked push
  // with CANCEL, unwinding exec; the driver swallows it (no leaked producer).
  let g = async function* (value) {
    if (flushed) throw Error('Call to a flushed pipe.');
    const isFlush = value === defs.none;
    if (isFlush) flushed = true;

    const pending = [];
    /** @type {((value?: any) => void) | null} */
    let wakeConsumer = null;
    /** @type {((value?: any) => void) | null} */
    let resolveProducer = null;
    /** @type {((reason?: any) => void) | null} */
    let rejectProducer = null;
    let done = false,
      error = null,
      cancelled = false;
    const CANCEL = Symbol('cancel');

    const push = v => {
      if (cancelled) throw CANCEL;
      pending.push(v);
      if (wakeConsumer) {
        const w = wakeConsumer;
        wakeConsumer = null;
        w();
      }
      return new Promise((res, rej) => {
        resolveProducer = res;
        rejectProducer = rej;
      });
    };

    Promise.resolve()
      .then(() => (isFlush ? execFlush(fns, 0, push) : execNext(value, fns, 0, push)))
      .then(
        () => {},
        e => {
          if (e !== CANCEL) error = e;
        }
      )
      .finally(() => {
        done = true;
        if (wakeConsumer) {
          const w = wakeConsumer;
          wakeConsumer = null;
          w();
        }
      });

    try {
      for (;;) {
        while (pending.length) {
          const v = pending.shift();
          if (resolveProducer) {
            const r = resolveProducer;
            resolveProducer = rejectProducer = null;
            r();
          }
          yield v;
        }
        if (error) throw error;
        if (done) return;
        await new Promise(res => (wakeConsumer = res));
      }
    } finally {
      cancelled = true;
      if (rejectProducer) {
        const rj = rejectProducer;
        resolveProducer = rejectProducer = null;
        rj(CANCEL);
      }
    }
  };

  const needToFlush = fns.some(fn => defs.isFlushable(fn));
  if (needToFlush) g = defs.flushable(g);
  return defs.setFunctionList(g, fns);
};

gen.next = next;

export default gen;
export {gen, next};
