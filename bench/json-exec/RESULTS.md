# json-exec — value-or-promise executor investigation

Does replacing the `async function applyFns` (the fused multi-fn executor in
`asStream` / `asWebStream`) with a sync-when-possible value-or-promise executor
recover the per-item async-frame tax? Measured, both substrates.

**Scope caveat (read first):** every number below is from a SYNTHETIC pipeline
that mimics stream-json's _shape_, not from real stream-json over a real
document. It isolates the executor layer. Real end-to-end stream-json gains will
be **smaller** — the parser's regex scan + token allocation share wall-time with
the executor. These are "executor-layer, synthetic" numbers, nothing more. No
claim here is asserted beyond what the file in this folder measures.

## Pipeline (copied inline in each bench — files don't share definitions)

```
record ──tokenize──▶ many(32 tokens) ─pick(drop ~½)─ assemble ─keep(drop ~½)─ emit
```

The `many()` fan-out at a non-terminal stage forces `applyFns` into one
recursive `await apply(...)` per token. All stages are synchronous, no
flushables — the happy path, where the async frames buy nothing.

## Files

| file                          | comparison                                                   | isolates                                    |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `exec.js`                     | — (prototype executor under test)                            |                                             |
| `asStream-exec.js`            | — (copy of `src/asStream.js`, applyFns→prototype exec)       |                                             |
| `asStream-src.js`             | — (copy of `src/asStream.js`, applyFns→`src/exec.js` `next`) |                                             |
| `asWebStream-exec.js`         | — (copy of `src/asWebStream.js`, applyFns→exec)              |                                             |
| `core.js`                     | `fun` vs `gen` vs `exec`, in-process                         | executor cost, no stream machinery          |
| `core-fun.js`                 | `fun` vs `fun-via-exec` (both collect→`many`)                | can the exec engine subsume `fun()`         |
| `node.js`                     | `applyFns` vs prototype exec, same Node Duplex               | **the executor swap, nothing else**         |
| `node-src.js`                 | `applyFns` vs `src/exec.js`, same Node Duplex                | promoted module preserves perf              |
| `web.js`                      | `applyFns` vs `exec`, same Web Streams chain                 | same swap, Web substrate                    |
| `node-async.js`               | `applyFns` vs `exec`, async stage                            | regression check when a stage awaits        |
| `correctness/backpressure.js` | applyFns vs exec vs naive-control                            | bounded queue under the 3 swelling vectors  |
| `correctness/stop-flush.js`   | applyFns vs exec                                             | Stop + flush output equivalence             |
| `correctness/async-stages.js` | applyFns vs exec                                             | async fn / async gen / thenable equivalence |

`node.js` / `node-src.js` / `web.js` are the decision benchmarks: identical
source, fn-list, and backpressure wiring — only the executor differs.

## Results — node v26.0.0 (v8 14.6.202.33-node.19), Linux x86_64

nano-bench 1.0.16, 95% CI, 100 samples, 50ms/sample. Time is **per record**
(32 tokens through 5 stages). All cases return 264308800 at n=1000.

### core.js — in-process executors

| case       | median / record | op/s     |
| ---------- | --------------- | -------- |
| `gen`      | 11.55 µs        | 87k      |
| `fun`      | 4.92 µs         | 203k     |
| **`exec`** | **3.95 µs**     | **253k** |

### node.js — same Node Duplex, executor swapped

| case                 | median / record | op/s     |
| -------------------- | --------------- | -------- |
| `applyFns (current)` | 10.49 µs        | 95k      |
| **`exec (new)`**     | **7.79 µs**     | **128k** |

**`exec` is 34.7% faster** (significant). Duplex/backpressure unchanged, so the
2.70 µs/record delta is the removed per-token `await`.

### web.js — same Web Streams chain, executor swapped

| case                 | median / record | op/s    |
| -------------------- | --------------- | ------- |
| `applyFns (current)` | 17.03 µs        | 59k     |
| **`exec (new)`**     | **15.30 µs**    | **65k** |

**`exec` is 11.3% faster** (significant). Smaller than Node because Web Streams'
default `hwm=1` makes every _output_ enqueue hit backpressure — both executors
suspend there; `exec`'s win is confined to the filtered tokens and intermediate
traversals it keeps synchronous.

### node-async.js — same Node Duplex, but the `keep` stage awaits per item

| case                 | median / record | op/s    |
| -------------------- | --------------- | ------- |
| `applyFns (current)` | 12.39 µs        | 81k     |
| **`exec (new)`**     | **11.75 µs**    | **85k** |

**`exec` is 5.45% faster — no regression** on async pipelines. The win shrinks
from 35% because a genuinely-async stage forces both executors to await per
survivor; `exec` still keeps the upstream many()-fan-out + filtered tokens
synchronous, so it stays marginally ahead rather than paying a penalty for its
.then-chaining.

### node-src.js — same as node.js but drives the PROMOTED `src/exec.js`

| case                     | median / record | op/s     |
| ------------------------ | --------------- | -------- |
| `applyFns (current)`     | 10.62 µs        | 94k      |
| **`exec (src/exec.js)`** | **7.86 µs**     | **127k** |

**35% faster** — reproduces node.js's prototype number, so the promotion from
`bench/json-exec/exec.js` to `src/exec.js` preserved the perf (confirmed, not
assumed). Identical output.

### Cross-runtime — `exec` faster than baseline (all benches)

Node v26.0.0 / Bun 1.3.x / Deno 2.x, same host. "+x%" = exec faster than
`applyFns` (or, for `core`, than `fun`). Positive = win.

| bench                                 | Node   | Bun          | Deno   |
| ------------------------------------- | ------ | ------------ | ------ |
| `node-src` (src/exec.js, Node Duplex) | +35%   | +59.3%       | +32.3% |
| `node` (prototype, Node Duplex)       | +33.4% | +57.9%       | +26.7% |
| `web` (Web Streams)                   | +10.7% | +16.8%       | +11.6% |
| `node-async` (a stage awaits)         | +4.7%  | −1.3% (wash) | +2.6%  |
| `core` (in-process, vs `fun`)         | +23.6% | +14.5%       | +25.4% |

Trend: the sync-heavy path wins on every runtime (Bun largest at ~59%); `src` ≈
prototype everywhere; Web is positive on all three (not Node-only); the
async-saturated case is the only soft spot — a small win on Node/Deno and a
~1.3% wash on Bun (CI bands overlap), i.e. "faster or even" everywhere, never a
meaningful regression.

## Executor ranking — exec vs fun vs gen (in-process)

`exec` is faster than **both** `fun()` and `gen()` on every runtime — but the
two comparisons are not equally fair.

**exec vs `fun` — solidly faster, even apples-to-apples.** `core-fun.js` builds a
`fun`-shaped driver on `exec`'s `next` (collect into an array, return `many()` —
identical semantics to `fun()`) so only the engine differs:

| `fun via exec` vs `fun` | Node   | Bun    | Deno |
| ----------------------- | ------ | ------ | ---- |
|                         | +17.1% | +12.4% | +20% |

`exec`'s engine routes through fewer wrappers than `fun()`'s `asArray → collect
→ next` chain. Used with its native _push_ API instead (sum directly — no
`many()` array, no per-record await; `core.js`) the gap is wider (+23.6 / +14.5
/ +25.4%). So `fun()` could be rebuilt on `exec` and come out faster — a
unification signal (one `next` for `fun` + the stream push-paths).

**exec vs `gen` — much faster, but NOT like-for-like.** ~2.9× (Node), ~3.1×
(Bun), ~186% (Deno). `gen()` is an async generator: pull-based, lazy, and it
pays the async-iteration protocol (`for await`, a promise per `.next()`) on
every item regardless of executor logic. `exec` is push-based and synchronous.
The margin is mostly `gen`'s async-iteration cost, not a tighter loop — `gen`'s
value is laziness / composability as an async iterable, not throughput. So the
honest reading is "synchronous push beats async-generator iteration," not "exec
is 3× the executor `gen` is."

## Verdict

A real, measured executor-layer win on **both** substrates (Node ~35%, Web ~11%
on this synthetic pipeline). **Not** Node-only — the earlier "asWebStream must
stay async, 36× win" was a conflation of _async-per-item_ with _an old
sync-burst executor that ignored backpressure_; the value-or-promise executor
respects per-item backpressure (suspends exactly when `enqueue` returns the
drain promise) and so subsumes that fix rather than contradicting it. That claim
is retracted — it was never benchmarked.

Correctness gate **passed** (bounded queue, Stop/flush, async stages — see
below), and no regression on async pipelines. What this does NOT establish: the
real end-to-end stream-json number (unmeasured; will be smaller than the
synthetic ~35%).

## Promotion gate (before `exec` replaces `applyFns` in `src/`)

| gate                                                                               | status   | evidence                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded queue — 3 swelling vectors (many-at-end, many-mid-chain, generator-yields) | **PASS** | `correctness/backpressure.js`: exec peak = 16 (= hwm) on all three, same as applyFns; naive control swells to 5000 (test has teeth); output counts exact |
| Stop / flush equivalence (incl. stop-mid-many, flush-then-stop)                    | **PASS** | `correctness/stop-flush.js`: 5/5 cases identical output                                                                                                  |
| Async fn / async generator / thenable equivalence                                  | **PASS** | `correctness/async-stages.js`: 6/6 cases identical output                                                                                                |
| No perf regression when a stage awaits                                             | **PASS** | `node-async.js`: exec 5.45% faster, not slower                                                                                                           |

## Rollout status (creeping to `src/`)

- **Step 1 — DONE.** Standalone `src/exec.js` (+ `src/exec.d.ts`) landed
  alongside `fun()`/`gen()`; the three swelling vectors + Stop/flush + async
  equivalence are now tape6 tests in `tests/core/test-exec.js` (16 tests, green
  on Node / Deno / Bun). `node-src.js` confirms the promoted module holds the
  perf. Thenable checks inlined to match `fun.js`/`gen.js`/`asStream.js` house
  style (measured neutral).
- **Step 2 — next.** Alternative `asStream` / `asWebStream` variants on
  `exec`'s `next` (the `asStream-src.js` here is the seed), tested for
  equivalence + perf, then promoted — unifying `processValue` + `applyFns` into
  one executor.
- **Step 3** — apply to `chain()` if it still makes sense.
- **Step 4** — `npm link` into stream-json for the **realistic end-to-end**
  number (cross-repo; the only basis for a user-facing perf claim — still
  unmeasured, will be smaller than the synthetic ~35%).
- **Step 5** — publish-or-not decision from those numbers.
