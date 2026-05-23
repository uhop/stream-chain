# batched-drain benchmark results

Harness: `bench/bench-batched-drain.js`. See
`projects/stream-chain/design/batched-drain.md` (vault) for the design.

`op/s` is per-item (nano-bench normalizes by the 200k batch), i.e. items/sec.
Lower per-item time = faster drain.

## Baseline vs. batched (2026-05-23)

- Runtime: node v26.0.0, linux/x64
- Command: `node ~/Open/nano-bench/bin/nano-bench.js -i 200000 -s 60 bench/bench-batched-drain.js`

| scenario                   | median/item | op/s (items/s) | vs. its per-item baseline |
| -------------------------- | ----------- | -------------- | ------------------------- |
| identity per-item          | 316.6 ns    | ~3M            | —                         |
| identity batched           | 280 ns      | ~4M            | 1.13×                     |
| fanout per-item            | 155.3 ns    | ~6M            | —                         |
| **fanout batched**         | **51.2 ns** | **~20M**       | **3.03×**                 |
| fanout-out per-item        | 177.5 ns    | ~6M            | —                         |
| **fanout-out batchOutput** | **48.2 ns** | **~21M**       | **3.68×**                 |

All differences statistically significant (Kruskal-Wallis + pairwise, 95% CI).

Notes:

- **`fanout` is the parser shape** (1 input → K=100 items; the section drains K
  pushes per input). Batching collapses those into one `push(many([…1000]))` per
  1000 items into the `batched()` sink → **3.03×**. `fanout-out` is the same
  shape read off the chain's own output via `batchOutput` (the `for await`
  case) → **3.68×**.
- **`identity` 1:1 gains only ~13%** because its _input_ side stays per-item
  (the source emits items one at a time into the section); only the section's
  _output_ batches. A `batched()` source emitting `many()` would close that
  input-side gap — not measured here.
- The isolated prototype's ~55× was pure drain (pre-built tokens, raw
  `stream.push`, no source/fn/consumer). ~3× is the honest end-to-end number
  through real `chain()` with `readableFrom`, `applyFns`, and a counting
  consumer in the loop. The counting consumer is maximally fast, so at ~20M
  items/s the irreducible per-item consumer work is now a large fraction of
  what remains.
- `batch: 1` (or unset-then-`<=1`) reproduces the per-item baseline exactly —
  the disable path is byte-for-byte today's behavior.
