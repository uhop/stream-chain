// @ts-self-types="./lines.d.ts"

import {none, flushable} from '../defs.js';

const lines = () => {
  let rest = '';
  return flushable(function* (value) {
    if (value === none) {
      if (!rest) return;
      const result = rest;
      rest = '';
      yield result;
      return;
    }
    const lines = value.split(/\r?\n/g);
    rest += lines[0];
    if (lines.length < 2) return;
    // Only a leading LF can complete a CRLF left in rest by a previous chunk.
    lines[0] = value[0] === '\n' && rest.endsWith('\r') ? rest.slice(0, -1) : rest;
    rest = lines.pop();
    yield* lines;
  });
};

export default lines;
export {lines};
