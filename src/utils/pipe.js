// @ts-self-types="./pipe.d.ts"

// One-shot single-value driver for a gen pipeline. `pipe(...stages)` returns a
// function shaped like `gen(stages)`, but its async generator drives the
// supplied value through THEN flushes the pipeline (`g(value)` followed by
// `g(none)`). Without that flush, flushable sink stages — notably the file
// writer in `stringerToFile` that must close its FileHandle — never run their
// `final()`. Plain `gen` and `/core chain` don't flush on their own; the Node
// `asStream` Duplex does (via stream-end), but in the pure-functional core
// path the caller has to.
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
    // Flush even when the data pass short-circuits — a stage issues `stop`,
    // a stage throws, or the consumer breaks the `for await` early — so a
    // flushable sink's `final()` (e.g. `asyncBlockWriter` / `stringerToFile`
    // closing its FileHandle) always runs instead of leaking the handle.
    let dataError,
      raised = false;
    try {
      yield* g(value);
    } catch (e) {
      dataError = e;
      raised = true;
    } finally {
      try {
        yield* g(none);
      } catch (flushError) {
        // If the flush throws too, keep both. AggregateError (ES2021 —
        // available on every target, including `/core` in browsers) carries
        // them in `.errors` in the order they occurred: the data-pass error
        // first, then the flush error.
        if (raised) {
          throw new AggregateError(
            [dataError, flushError],
            'pipe(): flush failed after a pipeline error'
          );
        }
        throw flushError;
      }
    }
    if (raised) throw dataError;
  };

export default pipe;
export {pipe};
