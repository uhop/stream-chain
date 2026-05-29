// @ts-self-types="./stringer.d.ts"

// Node-flavored JSONL stringer entry. The factory returns a Node `Transform`;
// `.asStream` is the factory itself and `.asWebStream` returns the Web
// `TransformStream`. Delegates to the existing adapter modules. No `.stringer`
// self-alias (that is a dead CJS→ESM shim — the dual `export default` / named
// export already covers both import forms).

import stringerStream from '../../jsonl/stringerStream.js';
import stringerWebStream from '../../jsonl/stringerWebStream.js';

const stringer = options => stringerStream(options);
stringer.asStream = stringer;
stringer.asWebStream = options => stringerWebStream(options);

export default stringer;
export {stringer, stringer as jsonlStringer};
