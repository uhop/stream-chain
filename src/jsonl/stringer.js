// @ts-self-types="./stringer.d.ts"

// Function-shaped JSONL stringer. Emits `JSON.stringify(value)` per input,
// joined by `separator` (default `"\n"`), with optional `prefix` / `suffix` /
// `emptyValue`. Returns a flushable so the terminal `suffix` (or the
// `emptyValue` for an empty stream) is emitted on flush. Composes into a
// `gen([…])` pipeline before a downstream string sink (e.g.
// `asyncBlockWriter`); the Node `Transform` variant is `stringerStream`.

import {flushable, none} from '../defs.js';

const stringer = options => {
  let first = true;
  let prefix = '';
  let suffix = '';
  let separator = '\n';
  let emptyValue;
  let replacer;
  let space;
  if (options) {
    if (typeof options.prefix == 'string') prefix = options.prefix;
    if (typeof options.suffix == 'string') suffix = options.suffix;
    if (typeof options.separator == 'string') separator = options.separator;
    if (typeof options.emptyValue == 'string') emptyValue = options.emptyValue;
    replacer = options.replacer;
    space = options.space;
  }
  return flushable(value => {
    if (value === none) {
      if (first) return typeof emptyValue == 'string' ? emptyValue : prefix + suffix;
      return suffix || none;
    }
    const result = JSON.stringify(value, replacer, space);
    if (first) {
      first = false;
      return prefix + result;
    }
    return separator + result;
  });
};

export default stringer;
export {stringer};
