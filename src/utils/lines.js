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
    lines[0] = rest;
    rest = lines.pop();
    yield* lines;
  });
};

export default lines;
export {lines};
