# `none`/`many()` function vs synchronous generator

Does a plain sync function returning `none`/`many()` beat a **synchronous generator**
for a 1 → 0..N transform, and how does that change with fan-out? Source: `sweep.js`.

**Scope.** In-process only (no stream machinery), trivial per-output work (copies of
`x`), so the `none`/`many` vs `yield`/iterate mechanics dominate, not the processing.
Each input: even → `none` (0 outputs), odd → K copies. At K=1 the function form is the
idiomatic **bare value return** (no `many` wrapper); at K≥2 it returns `many([…K])`. The
generator form always `yield`s K times (or 0). Two drivers: `fun()` (sync-first) and
`gen()` (async-iterable). nano-bench 1.0.16, 95% CI, 100 samples, 50 ms/sample, Linux
x86_64. Median **per input** (`n` auto-scaled). Checksum = 250000 × K at n=1000.

## fun() — sync-first (the purest view of the mechanics)

| fan-out | function (Node) | generator (Node) | function faster — Node / Bun / Deno |
| ------- | --------------- | ---------------- | ----------------------------------- |
| ×1      | 277 ns          | 415 ns           | **1.50× / 1.58× / 1.55×**           |
| ×4      | 600 ns          | 709 ns           | 1.18× / 1.17× / 1.16×               |
| ×16     | 1.55 µs         | 1.84 µs          | 1.19× / 1.07× / 1.22×               |

## gen() — async-iterable

| fan-out | function (Node) | generator (Node) | function faster — Node / Bun / Deno |
| ------- | --------------- | ---------------- | ----------------------------------- |
| ×1      | 1.00 µs         | 1.19 µs          | 1.18× / 1.29× / 1.19×               |
| ×4      | 1.86 µs         | 1.95 µs          | 1.05× / 1.09× / 1.04×               |
| ×16     | 4.70 µs         | 4.89 µs          | 1.04× / 1.04× / 1.05×               |

## The curve

- **The function form always wins** — every fan-out, every driver, every runtime; it
  never loses.
- **The advantage is largest at fan-out 1** (~1.5–1.6× sync, ~1.2–1.3× async) and
  **shrinks as fan-out grows** toward ~1.05–1.2×. That's the opposite of the naive guess
  ("more `yield`s = bigger generator penalty"): more outputs _narrows_ the gap.
- **Why:** at fan-out 1 the function returns a **bare value** — no `many()`, no array —
  while the generator still pays its whole protocol (instantiation + `.next()` /
  `{value, done}`) to emit one value. As fan-out grows, both sides become
  per-output-linear (build+iterate a K-array vs K × `.next()`), so the function's _fixed_
  structural advantage amortizes toward parity.
- **The `gen()` driver shows a smaller gap than `fun()` at every fan-out** — its
  async-iteration overhead partly masks the producer-mechanic difference (consistent with
  the async findings in `../pipeline-vs-chain/RESULTS.md`).

## Takeaway

Prefer a plain function with `none`/`many()` over a generator — and the win is **biggest
exactly where it's most common**: filter/map (0 or 1 output), where you return `none` or
a bare value and skip the generator protocol entirely (~1.5× on V8, sync path). At large
fan-out the two are nearly perf-neutral (~5–20%), so choose whichever reads better there.
Combined with the async experiment (`../pipeline-vs-chain/` § Async transforms): the
cheapest 1 → 0..N transform is a **plain, sync function with `none`/`many()`** — generators,
sync or async, cost more.
