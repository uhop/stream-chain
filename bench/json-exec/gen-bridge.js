// How much of the +39% (gen-via-exec) survives once the bridge does proper
// early-termination cleanup? Three ways to produce the same gen output:
//   - gen (native)         — async function* + yield*
//   - gen via exec (naive) — push→pull bridge, leaks the parked producer on early break
//   - gen via exec (clean) — same, but a for-await `break` cancels the producer
//                            (rejects the parked push promise) via try/finally
//
// Same pipeline, copied inline.
//   record ──tokenize──▶ many(32) ─pick─ assemble ─keep─ emit

import gen from 'stream-chain/gen.js';
import * as defs from 'stream-chain/defs.js';
import {next} from '../../src/exec.js';

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

const g = gen(...fns);

// naive bridge: no cleanup. A for-await `break` abandons the parked producer.
const naiveBridge = (gfns, onSettle = () => {}) =>
  async function* (input) {
    const pending = [];
    let wakeConsumer = null;
    let wakeProducer = null;
    let done = false;
    let error = null;

    const push = v => {
      pending.push(v);
      if (wakeConsumer) {
        const w = wakeConsumer;
        wakeConsumer = null;
        w();
      }
      return new Promise(res => (wakeProducer = res));
    };

    Promise.resolve()
      .then(() => next(input, gfns, 0, push))
      .then(
        () => {},
        e => (error = e)
      )
      .finally(() => {
        done = true;
        if (wakeConsumer) {
          const w = wakeConsumer;
          wakeConsumer = null;
          w();
        }
        onSettle();
      });

    for (;;) {
      while (pending.length) {
        const v = pending.shift();
        if (wakeProducer) {
          const w = wakeProducer;
          wakeProducer = null;
          w();
        }
        yield v;
      }
      if (error) throw error;
      if (done) return;
      await new Promise(res => (wakeConsumer = res));
    }
  };

// clean bridge: a for-await `break` triggers .return() → the finally rejects the
// parked push promise with a CANCEL sentinel, unwinding exec; the driver swallows
// it. No leaked closure.
const cleanBridge = (gfns, onSettle = () => {}) =>
  async function* (input) {
    const pending = [];
    let wakeConsumer = null;
    let resolveProducer = null;
    let rejectProducer = null;
    let done = false;
    let error = null;
    let cancelled = false;
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
      .then(() => next(input, gfns, 0, push))
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
        onSettle();
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

const naive = naiveBridge(fns);
const clean = cleanBridge(fns);

export default {
  async ['gen (native)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) for await (const x of g(i)) acc += x;
    return acc;
  },
  async ['gen via exec (naive)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) for await (const x of naive(i)) acc += x;
    return acc;
  },
  async ['gen via exec (clean)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) for await (const x of clean(i)) acc += x;
    return acc;
  }
};

export {naiveBridge, cleanBridge, fns};
