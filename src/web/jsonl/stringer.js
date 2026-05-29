// @ts-self-types="./stringer.d.ts"

// Web-flavored JSONL stringer entry. Browser-safe: imports only the Web Streams
// adapter. The factory returns the Web `TransformStream`; `.asWebStream` is the
// factory itself. No `.stringer` self-alias.

import stringerWebStream from '../../jsonl/stringerWebStream.js';

const stringer = options => stringerWebStream(options);
stringer.asWebStream = stringer;

export default stringer;
export {stringer, stringer as jsonlStringer};
