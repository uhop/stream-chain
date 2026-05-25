// Can exec() be adapted to gen()? exec is push; gen is pull. Bridging them needs
// a 1-slot coroutine handoff: each push BLOCKS (returns a promise) until the
// consumer pulls the next value, so the producer runs strictly one item ahead.
// That handshake is a per-item promise — exactly the async-iteration cost gen
// pays natively — so the adapter should be SLOWER than native gen. This file
// measures native gen vs gen-built-on-exec to confirm the tradeoff.
//
// Same thing, two ways; pipeline copied inline.
//   record ──tokenize──▶ many(32) ─pick─ assemble ─keep─ emit

import gen from 'stream-chain/gen.js';
import {many, none} from 'stream-chain/defs.js';
import {next} from '../../src/exec.js';

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

const g = gen(...fns);

// Push→pull bridge: exec drives the producer; each push parks on a promise the
// consumer resolves when it pulls. One value in flight at a time (bounded).
const genViaExec = (...gfns) =>
  async function* (input) {
    const pending = [];
    let wakeConsumer = null; // producer → consumer: value (or done) ready
    let wakeProducer = null; // consumer → producer: pulled, continue
    let done = false;
    let error = null;

    const push = v => {
      pending.push(v);
      if (wakeConsumer) {
        const w = wakeConsumer;
        wakeConsumer = null;
        w();
      }
      return new Promise(res => (wakeProducer = res)); // block until consumed
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

const gve = genViaExec(...fns);

export default {
  async ['gen (native)'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for await (const x of g(i)) acc += x;
    }
    return acc;
  },

  async ['gen via exec'](n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for await (const x of gve(i)) acc += x;
    }
    return acc;
  }
};
