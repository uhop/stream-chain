# pipeline() / compose() vs chain() — Node-interop perf + ergonomics

Should you drop stream-chain for Node's own composition tools — `stream.pipeline()`
and `stream.compose()`? This quantifies the gap, and doubles as an ergonomics
side-by-side (source: `chain-vs-builtins.js`).

**Scope caveat (read first).** Synthetic, in-memory, trivial transforms — it measures
**packaging + per-item overhead**, not real I/O (no file/socket/byte stream, which is
the only place streams earn their keep: backpressure, byte I/O, flat memory over
unbounded input). So if your data fits in memory with no I/O, **write the loop** — it's
10–60× faster than anything here, and that's expected, not a verdict on the tools. Every
"a tool composes the fns" case feeds the five fns as **five separate stages**: the tool
does the composing — no case hands a tool a pre-fused single stage (that would credit it
with a merge it didn't perform).

## Results

nano-bench 1.0.16, 95% CI, 100 samples, 50 ms/sample, sequential. Median **per item**
(`n` auto-scaled), Linux x86_64. All cases return 500500 at n=1000. **stream?** = builds
a reusable `Duplex` (what `chain()` exists to produce). Sorted fastest → slowest by Node.

| case                           | stream? | Node       | Bun     | Deno       |
| ------------------------------ | ------- | ---------- | ------- | ---------- |
| plain loop (no framework)      | no      | 29 ns      | 18 ns   | 29 ns      |
| chain — terminal fn            | yes     | 167 ns     | 1.15 µs | 181 ns     |
| raw async generator            | no      | 323 ns     | 300 ns  | 317 ns     |
| **chain — plain fns (merged)** | yes     | **517 ns** | 1.60 µs | **524 ns** |
| gen() — stream-free            | no      | 665 ns     | 1.55 µs | 640 ns     |
| pipeline — async-gen per fn    | no      | 1.01 µs    | 889 ns  | 906 ns     |
| pipeline — Transform per fn    | no      | 1.39 µs    | 1.45 µs | 1.44 µs    |
| compose — Transform per fn     | yes     | 1.40 µs    | 1.48 µs | 1.44 µs    |
| chain — stage per fn           | yes     | 1.53 µs    | 3.57 µs | 1.58 µs    |
| chain — Transform per fn       | yes     | 1.71 µs    | 1.94 µs | 1.81 µs    |

## Findings

1. **Pass functions and chain wins.** `chain — merged` (517 ns Node / 524 Deno) beats
   every builtin that _composes_ the five fns — `pipeline` async-gen/fn (1.0 µs),
   `pipeline`/`compose` Transform/fn (1.4 µs) — by **~2–2.7×**, because chain fuses the
   stages into one Duplex and the builtins can't.

2. **The fusion is the whole win.** Same five fns: merged into one stage = 517 ns; forced
   one-stream-per-fn = 1.5–1.7 µs — a **~3× swing inside chain**. The rule is "pass
   functions, don't wrap each in its own stream."

3. **Force per-stream and chain ≈ the builtins, slightly behind.** With one stream per fn,
   `chain — Transform/fn` (1.71 µs) sits ~20% above `pipeline`/`compose` Transform/fn
   (1.4 µs) — the cost of chain's outer-Duplex wrapper. Once you discard merging there is
   no chain advantage; the builtins edge ahead.

4. **Don't need a stream? Don't use one.** raw async generator ~320 ns, plain loop ~30 ns
   — far under any stream path. stream-chain's own stream-free gears (`gen()`/`fun()`/
   `/core`) live here; `gen()` (665 ns) carries a `none`/`many` tax over a bare generator.

5. **`chain — terminal fn` (167 ns) is the fastest framework case** — under even raw async
   generators — because the merged executor runs the whole per-item path synchronously,
   paying no `await` per item (see `../consume/`).

6. **Bun taxes Node-Duplex paths** (every `Duplex` case 1.1–3.6 µs); there the stream-free
   async-gen path dominates.

## Verdict

For a real, composable stream, `chain()` with **functions** is ~2–2.7× faster than
`pipeline()`/`compose()` — it fuses, they can't. Throw the fusion away by wrapping each fn
in a stream and it's a wash: chain trails the builtins by ~20% (its outer-Duplex wrapper).
And if you don't need a stream at all, a loop or a hand-written async generator beats
everything with no library. So: pass functions when you need a stream; use a loop when you
don't. The builtins lead only in the regime you shouldn't be in — one stream per trivial
fn — and even there only barely. Bun is the caveat, and how you **drain** the output
(`../consume/`) matters as much as how you build it.
