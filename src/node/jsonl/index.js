// @ts-self-types="./index.d.ts"

// Curated barrel for the Node-flavored JSONL entry points: the two bundled
// factories under their canonical names. Not a catch-all re-export of the whole
// `jsonl/` tree — just the substrate's parser + stringer.

import jsonlParser from './parser.js';
import jsonlStringer from './stringer.js';

export {jsonlParser, jsonlStringer};
