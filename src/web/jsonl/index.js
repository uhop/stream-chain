// @ts-self-types="./index.d.ts"

// Curated barrel for the Web-flavored JSONL entry points: the two bundled
// factories under their canonical names. Browser-safe — both entries avoid
// `node:stream`.

import jsonlParser from './parser.js';
import jsonlStringer from './stringer.js';

export {jsonlParser, jsonlStringer};
