// @ts-self-types="./parser.d.ts"

// Node-flavored JSONL parser entry. A fresh factory (so the shared browser-safe
// `parser` export object from `../../jsonl/parser.js` is not mutated) that returns
// the gen chain and carries `.asStream` (Node Duplex) and `.asWebStream` (Web pair)
// adapters. Delegates to the existing adapter modules — no logic is duplicated.

import parser, {jsonlParser} from '../../jsonl/parser.js';
import parserStream from '../../jsonl/parserStream.js';
import parserWebStream from '../../jsonl/parserWebStream.js';

const jsonlParserNode = options => parser(options);
jsonlParserNode.asStream = options => parserStream(options);
jsonlParserNode.asWebStream = options => parserWebStream(options);

export default jsonlParserNode;
export {jsonlParserNode as parser, jsonlParser};
