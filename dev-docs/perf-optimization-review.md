# Performance optimization review

Analysis of the uncommitted changes to `src/asStream.js` and `src/index.js`.

> **Status:** Phases 1–4 completed. See "Execution log" at the end.

## What the changes do

### asStream.js (134 → 366 lines)

Three optimization layers were added:

1. **Function-list fast path (`applyFns`/`drainValue`)** — When the function passed to `asStream()` was produced by `gen()`, extract the inner function list and apply them directly in a tight loop, avoiding the async generator entirely. Returns `undefined` for sync completion or a `Promise` for async fallback.

2. **Single-function sync fast path** — Even without a function list, call `fn(chunk, encoding)` synchronously and check the result. If it is a plain value (not a promise, generator, or special), push it directly and invoke the callback without creating any promises.

3. **Flush fast path** — In `final()`, flush inner flushable functions directly via `drainValue` instead of going through the async `processChunk` path.

### index.js (248 → 307 lines)

One optimization:

- **Trailing function extraction** — After grouping, extract the trailing non-flushable functions from the last function group. Instead of wrapping them in a stream, apply them synchronously in the `data` event handler of the preceding output stream. This eliminates one stream boundary.

## Current test results

All 183 existing tests pass (Node, Bun, Deno, TypeScript). However, the existing tests were not designed to exercise these specific fast paths under edge conditions.

## Issues found

### Critical: `index.js` trailing functions assume synchronous execution

`applyTrailing` (index.js lines 189–211) applies extracted functions synchronously. It does not handle:

- **Promises** — If a trailing function returns a promise, the promise object itself is pushed as a value.
- **Generators** — If a trailing function returns a generator/iterator, it is pushed as-is instead of being iterated.
- **Async generators** — Same problem.

This is a **regression** for any pipeline where the last function group contains async or generator functions. Example:

```js
chain([
  readableStream,
  async x => await transform(x) // extracted as trailing → promise pushed as value
]);
```

The `asStream.js` fast path (`applyFns`) handles all of these correctly via `drainValue`. The `index.js` trailing path does not.

**Recommendation:** Remove the `index.js` trailing optimization entirely. The `asStream.js` fast path already eliminates the per-item async overhead, which is the dominant cost. The trailing extraction saves one stream boundary but introduces a class of regressions that is hard to guard against at construction time (we cannot know whether a function will return a promise until it runs).

### Major: code duplication in asStream.js

`applyFns` and `drainValue` contain heavily duplicated logic for handling `none`, `stop`, `many`, `finalValue`, promises, and generators. The two functions exist because:

- `applyFns` is the "apply functions starting at index" entry point (tight sync loop).
- `drainValue` is the "value may be any special type, resolve it first, then continue applying" entry point.

They are mutually recursive: `applyFns` calls `drainValue` for async results, `drainValue` calls `applyFns` to continue after resolving. This is correct but hard to follow and maintain.

**Recommendation:** Consider unifying them. One approach: `applyFns` is the only entry point. It accepts a value and a start index. Before the function-application loop, it resolves the value (promise → await, generator → iterate, many → expand, etc.). This eliminates `drainValue` as a separate function.

### Minor: backpressure during many-expansion in fast path

In the `write()` fast path (asStream.js lines 217–255), backpressure is tracked with a boolean flag:

```js
let backpressure = false;
asyncResult = applyFns(chunk, 0, value => {
  if (!stream.push(value)) backpressure = true;
});
```

If `many()` expands to thousands of values pushed synchronously, all values are pushed even after backpressure is detected. The flag is only checked after `applyFns` returns. The original async path properly pauses between items via the `pump`/`queue` mechanism.

For most real-world cases (small many expansions, sync functions), this is acceptable. For pathological cases (large many expansions), this could cause memory pressure.

**Recommendation:** Acceptable for now. Document the limitation. If it becomes a problem, the push callback could throw a backpressure exception to break out of the loop early.

### Minor: `final()` fast path pushes null then checks backpressure

Lines 338–344: `stream.push(null)` is called before checking backpressure. Since `null` signals end-of-stream, the backpressure check on the callback is largely cosmetic. Not a bug, but the code could be clearer.

### Minor: generator cleanup on error

In `drainValue` (lines 62–70), if `drain(data.value, ...)` throws during generator iteration, the generator is not closed (no `generator.return()` call). This is consistent with the existing `gen.js` behavior, so it is not a regression, but it is a potential resource leak.

## Simplification plan

### Phase 1: Remove the `index.js` trailing optimization

Revert `index.js` to the committed version. The `asStream.js` fast path alone addresses the core performance problem (per-item async overhead).

- **Risk:** Low. Removes untested code path with known regression potential.
- **Impact on performance:** Negligible. The trailing optimization saves one stream boundary, but the per-item cost dominates. The `asStream.js` fast path already eliminates that.

### Phase 2: Simplify `asStream.js` fast path

Reduce `applyFns`/`drainValue` duplication. Target: one recursive function that handles both "apply next function" and "resolve special value" in a single control flow.

Sketch:

```js
const applyFns = innerFns
  ? function apply(value, i, push) {
      // resolve phase: handle specials before applying the next function
      if (value === undefined || value === null || value === defs.none) return;
      if (value === defs.stop) throw new defs.Stop();
      if (defs.isFinalValue(value)) {
        push(defs.getFinalValue(value));
        return;
      }
      if (defs.isMany(value)) {
        const values = defs.getManyValues(value);
        let pending;
        for (let j = 0; j < values.length; ++j) {
          if (pending) {
            const jj = j;
            pending = pending.then(() => apply(values[jj], i, push));
          } else {
            const result = apply(values[j], i, push);
            if (result) pending = result;
          }
        }
        return pending;
      }
      if (value && typeof value.then == 'function') {
        return value.then(v => apply(v, i, push));
      }
      if (value && typeof value.next == 'function') {
        return (async () => {
          for (;;) {
            let data = value.next();
            if (data && typeof data.then == 'function') data = await data;
            if (data.done) break;
            const result = apply(data.value, i, push);
            if (result) await result;
          }
        })();
      }
      // apply phase: call the next function
      if (i >= innerFns.length) {
        push(value);
        return;
      }
      return apply(innerFns[i](value), i + 1, push);
    }
  : null;
```

This unifies `applyFns` and `drainValue` into a single function. The sync fast path is preserved: if all functions return plain values, no promises or generators are created.

- **Risk:** Medium. Needs thorough testing. The unified function has more checks per iteration than the current split version, but the difference is likely negligible compared to the async overhead being eliminated.
- **Tradeoff:** Slightly more checks per sync iteration vs much simpler code.

### Phase 3: Keep the single-function sync fast path

The optimization in `write()` for non-function-list single functions (lines 257–299) is valuable and low-risk. It avoids creating promises for the common case of a single sync function. Keep it.

### Phase 4: Add targeted tests

Add tests that specifically exercise the fast paths:

- Sync function list (multiple sync functions grouped by `gen()`).
- Mixed sync/async function list (some functions return promises).
- Function list with generators.
- Function list with `many()`, `finalValue()`, `stop`, `none`.
- Function list with `flushable()` functions.
- Single sync function (non-function-list path).
- Single async function (should fall through to slow path).
- Backpressure under many-expansion.

### Phase 5: Add benchmarks

Deferred — `sj-test` uses large files not suitable for this repo. Benchmarks will be run externally.

## Code intersection: fun.js / gen.js

`fun.js next()` is structurally almost identical to the unified `applyFns`:

| Concern        | `fun.js next()`             | `gen.js next()`        | `applyFns`                 |
| -------------- | --------------------------- | ---------------------- | -------------------------- |
| Output         | `collect()` callback        | `yield`                | `push()` callback          |
| Sync/async     | Always async                | Always async generator | Sync-first, async fallback |
| Special values | All handled                 | All handled            | All handled                |
| Stop behavior  | Flush remaining, then throw | Just throw             | Just throw (matches `gen`) |

Direct reuse is not possible — `fun.next()` is always `async`, which defeats the optimization. The unified `applyFns` is a "sync-when-possible" adaptation of the same algorithm, using `push` instead of `collect`.

## Known issue: `finish` event after `stop`

When `stop` triggers `stream.destroy()`, neither `end` nor `finish` fires on downstream writables — only `close`. See `dev-docs/TODO-finish-event.md`.

## Execution log

- **Phase 1 ✓** — Reverted `index.js` trailing optimization (sync-only assumption was a regression risk).
- **Phase 2 ✓** — Unified `applyFns`/`drainValue` into a single recursive function in `asStream.js` (307 lines, down from 366).
- **Phase 3 ✓** — Kept single-function sync fast path in `write()`.
- **Phase 4 ✓** — Added 13 targeted fast-path tests in `tests/test-asStream-fast.mjs`. All 196 tests pass (Node, ts-check, lint).
- **Phase 5** — Deferred (external benchmarks).

## Summary

| Change                                 | Value                                     | Risk                              | Recommendation |
| -------------------------------------- | ----------------------------------------- | --------------------------------- | -------------- |
| `asStream.js` function-list fast path  | High — eliminates per-item async overhead | Medium — complex, needs tests     | Keep, simplify |
| `asStream.js` single-fn sync fast path | Medium — avoids promises for simple fns   | Low                               | Keep as-is     |
| `index.js` trailing extraction         | Low — saves one stream boundary           | High — breaks async/generator fns | Remove         |

The highest-impact optimization is the `asStream.js` function-list fast path. It directly addresses the root cause: `gen()` produces an async generator, and `asStream()` creates a promise per item to drive it. The fast path calls the inner functions directly, falling back to promises only when needed.

Remaining work: investigate the `finish`-after-`stop` issue (`dev-docs/TODO-finish-event.md`) and run external benchmarks to measure the improvement.
