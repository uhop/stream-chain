// @ts-self-types="./stringer.d.ts"

// `stringerToFile(path, options)` — output-edge sink stage that writes a JSONL
// stream of values to a file. Composes as the last element of a `gen([…])`
// pipeline; the pipe MUST be flushed for the writer's file handle to close —
// use `pipe(...)` from `stream-chain/utils/pipe.js` and drain via
// `drain(...)` from `stream-chain/utils/drain.js`.
//
//   import {pipe} from 'stream-chain/utils/pipe.js';
//   import {drain} from 'stream-chain/utils/drain.js';
//   import {parseFile} from 'stream-chain/jsonl/file/parser.js';
//   import {stringerToFile} from 'stream-chain/jsonl/file/stringer.js';
//
//   const c = pipe(parseFile(), v => v.value, stringerToFile('out.jsonl'));
//   await drain(c('input.jsonl'));
//
// Internally: the function-shaped JSONL `stringer` flushable followed by an
// `asyncBlockWriter` (buffers stringer output and writes fixed-size blocks via
// `fs/promises.write`; the writer's `final()` writes the tail and closes the
// FileHandle on flush). Node-only.

import {gen} from '../../core/index.js';
import stringer from '../stringer.js';
import asyncBlockWriter from '../../utils/asyncBlockWriter.js';

const stringerToFile = (path, options) => gen(stringer(options), asyncBlockWriter(path, options));

export default stringerToFile;
export {stringerToFile, stringerToFile as stringer};
