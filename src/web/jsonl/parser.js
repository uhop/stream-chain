// @ts-self-types="./parser.d.ts"

// Web-flavored JSONL parser entry. Browser-safe: imports only the pure parser and
// the Web Streams adapter — never `parserStream` / `node:stream`. A fresh factory
// (so the shared `parser` export object is not mutated) that returns the gen chain
// and carries `.asWebStream` (Web `{readable, writable}` pair). No `.asStream`.

import parser, {jsonlParser} from '../../jsonl/parser.js';
import parserWebStream from '../../jsonl/parserWebStream.js';

const jsonlParserWeb = options => parser(options);
jsonlParserWeb.asWebStream = options => parserWebStream(options);

export default jsonlParserWeb;
export {jsonlParserWeb as parser, jsonlParser};
