// @ts-self-types="./lines.d.ts"

'use strict';

const {none, flushable} = require('../defs');

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
    const lines = value.split('\n');
    rest += lines[0];
    if (lines.length < 2) return;
    lines[0] = rest;
    rest = lines.pop();
    yield* lines;
  });
};

module.exports = lines;
