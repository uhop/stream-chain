// @ts-self-types="./parser.d.ts"

// `parseFile(options)` — input-edge stage that turns a path into a JSONL
// `{key, value}` stream. Composes as the first element of a `gen([…])`
// pipeline; the chain is driven by passing the path as the gen input value.
//
//   import {pipe} from 'stream-chain/utils/pipe.js';
//   import {drain} from 'stream-chain/utils/drain.js';
//   import {parseFile} from 'stream-chain/jsonl/file/parser.js';
//
//   const c = pipe(parseFile(), /* downstream stages */);
//   await drain(c('input.jsonl'));
//
// Internally: an `asyncBlockReader` (async generator yielding decoded blocks
// from `fs/promises.open` + `StringDecoder('utf8')`) followed by `lines()` and
// the raw `jsonlParser`. Node-only.

import {gen} from '../../core/index.js';
import {jsonlParser} from '../parser.js';
import lines from '../../utils/lines.js';
import asyncBlockReader from '../../utils/asyncBlockReader.js';

// not `parser()`: the reader already decodes and drops the BOM, and the
// `fixUtf8Stream()` in front of `parser()` would drop a second U+FEFF
const parseFile = options => gen(asyncBlockReader(options), lines(), jsonlParser(options));

export default parseFile;
export {parseFile, parseFile as parser};
