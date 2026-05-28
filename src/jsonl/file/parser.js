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
// from `fs/promises.open` + `StringDecoder('utf8')`) followed by the existing
// JSONL `parser` flushable (which wraps `fixUtf8Stream → lines → JSON.parse`).
// Node-only.

import {gen} from '../../core/index.js';
import parser from '../parser.js';
import asyncBlockReader from '../../utils/asyncBlockReader.js';

const parseFile = options => gen(asyncBlockReader(options), parser(options));

export default parseFile;
export {parseFile, parseFile as parser};
