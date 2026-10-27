// @ts-self-types="./gen.d.ts"

import {genBridge} from './exec.js';

// gen() builds a push→pull async-generator bridge over the shared executor
// (exec.next / exec.flush) — ~45% faster than the recursive `async function*` it
// replaced, whose native `yield*` delegation instantiated a nested generator per
// many() element. See [[projects/stream-chain/design/sync-when-possible-executor]].
const gen = (...fns) => genBridge(fns, false);

export default gen;
export {gen};
