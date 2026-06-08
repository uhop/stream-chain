// @ts-self-types="./pipe.d.ts"

// One-shot single-value driver for a gen pipeline. `pipe(...stages)` returns a
// function shaped like `gen(stages)` whose async generator drives the supplied
// value through the pipeline (`g(value)`) and THEN flushes it (`g(none)`).
// Without that flush, flushable sink stages — notably the file writer in
// `stringerToFile` that must close its FileHandle — never run their `final()`.
// Plain `gen` and `/core chain` don't flush on their own; the Node `asStream`
// Duplex does (via stream-end), but in the pure-functional core path the caller
// has to. `g(none)` is always safe to call: `gen` routes it to the flush path,
// which is a no-op when no stage is flushable.
//
// The flush runs only when the data pass COMPLETES. If a stage throws, the
// exception leaves this generator at once and `g(none)` is never reached — by
// design. An exception is not a recoverable error: the stack has already
// unwound, so there is no point to resume. Re-driving the pipeline to flush
// would just re-run the work that threw (re-throwing the same failure) and would
// finalize a broken stream (emit partial tails, re-validate failed input). A
// failed pipeline is not finalized. Resource-owning SOURCE stages still release
// their handles regardless: a generator source gets `it.return()` (its
// `finally`) from the executor's abort path, independent of this flush. A
// resource-owning SINK that needs release on abort guards its own code with
// `try`/`catch`, or the caller does so in a `catch`/`finally` — the exception
// propagates intact (never suppressed), so it stays actionable.
//
// The returned function is single-shot per call: each invocation builds a
// fresh `gen` internally, so calling it again with another value is fine
// (the stages list is reused; for stateful stages such as parsers /
// stringers / writers, build a fresh `pipe` per use). Suitable for the
// "drive one path through, await completion" shape: `await drain(pipe(…)(path))`.

import {gen} from '../core/index.js';
import {none} from '../defs.js';

const pipe = (...stages) =>
  async function* (value) {
    const g = gen(...stages);
    yield* g(value); // data pass — a throw here propagates and skips the flush
    yield* g(none); // flush flushable sinks (a no-op when none are flushable)
  };

export default pipe;
export {pipe};
