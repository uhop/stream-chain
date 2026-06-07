# Output consumption — terminal function vs the alternatives

Does consuming a chain's output via a **terminal function** (a last stage that
accumulates and emits nothing) beat the event / reader / iterator ways of reading
the output? Measured on both substrates: Node (`node.js`) and Web Streams
(`web.js`).

**Scope caveat (read first):** the upstream is an identity pipeline (`1..n` through
five fns that net to the identity), so per-item transform work is trivial and the
**consumption overhead is a large fraction** of each measurement — on purpose, to
make it the signal. With heavier per-item work the relative gaps narrow. Also: a
terminal function only applies when you **don't need the values outside the
pipeline** (writing to a DB / file, accumulating, side-effecting). If a caller needs
the values, it must use `.on('data')` / `for await` (Node) or a reader / `pipeTo` /
puller (Web) — those exist for a reason; this measures their cost.

## Method

Same upstream in every case — `chain([source, ...fns])` (Node) /
`webChain([source, ...fns])` (Web) producing `1..n`. Only the drain differs. The
terminal-function case appends one plain fn returning `none`, so it merges into the
fused segment and the readable side carries no values at all. Every case returns
`sum(1..n) = n·(n+1)/2`.

nano-bench 1.0.16, 95% CI, 100 samples, 50ms/sample, sequential. Median **per item**
(`n` auto-scaled). Linux x86_64. All cases return 500500 at n=1000.

## Node substrate (`node.js`)

| case                    | Node v26.0.0 | Bun 1.3.14   | Deno 2.8.2   |
| ----------------------- | ------------ | ------------ | ------------ |
| **`terminal function`** | **185 ns**   | **1.156 µs** | **177.8 ns** |
| `.on('data')`           | 275.7 ns     | 1.282 µs     | 292.1 ns     |
| `for await...of`        | 526 ns       | 1.545 µs     | 499 ns       |

Ranking is identical on all three: **terminal < `.on('data')` < `for await`**. The
async-iterator protocol (`for await`) costs ~2.8× the terminal function on Node/Deno;
`.on('data')` sits between. Bun compresses the absolute numbers into a narrow
1.16–1.55 µs band (its Node-stream emulation floors all three higher) but keeps the
order.

## Web substrate (`web.js`)

| case                     | Node v26.0.0 | Bun 1.3.14   | Deno 2.8.2   |
| ------------------------ | ------------ | ------------ | ------------ |
| **`terminal function`**  | **176.5 ns** | **1.159 µs** | **150.5 ns** |
| `reader loop`            | 894 ns       | 1.670 µs     | 648 ns       |
| `makeWebStreamPuller`    | 1.032 µs     | 2.204 µs     | 878 ns       |
| `pipeTo(WritableStream)` | 1.806 µs     | 2.60 µs      | 1.217 µs     |

Same winner, **much** larger margin: the terminal function is **5–10× faster** than
any external Web-Streams consumer on Node, ~4–8× on Deno, ~1.4–2.2× on Bun. Among
the external methods a manual `reader` loop is cheapest, `makeWebStreamPuller` (an
async-iterator wrapper) next, and `pipeTo` the most expensive — Web Streams' per-read
/ per-write machinery is heavier per item than Node's event emission, so keeping the
data inside the pipeline saves the most here.

## Findings

1. **A terminal function is the fastest way to consume — on every runtime, both
   substrates.** It keeps the value inside the fused segment; the readable side
   transports nothing, so there is no per-item event, iterator handshake, or
   reader/`pipeTo` round-trip.

2. **The effect is modest on Node (~1.5–2.9×) but large on Web (5–10×).** If you're
   on the `/web` substrate and consuming in-process, a terminal function is by far
   the biggest single consumption win available.

3. **Among external consumers, pick by substrate.** Node: `.on('data')` beats
   `for await`. Web: a `reader` loop beats `pipeTo`; `makeWebStreamPuller` is the
   ergonomic middle (async-iteration syntax at a small premium over a raw reader).

4. **Bun floors everything higher** (Node-stream and Web-Streams machinery both cost
   more there) but never reorders the ranking.

## Verdict

When the pipeline's output is consumed in-process and the caller doesn't need the
values themselves, end the chain with a **terminal function** — it is both the most
portable shape (identical on Node and Web) and the fastest consumption, decisively so
on Web Streams. When the values must leave the pipeline, the relative costs above tell
you which exit to prefer per substrate. Pairs with `../pipeline-vs-chain/`, which
shows the same drain-method effect dominating the chain-vs-built-ins comparison.
