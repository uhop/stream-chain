// @ts-self-types="./parser.d.ts"

import {none} from '../defs.js';
import gen from '../gen.js';
import fixUtf8Stream from '../utils/fixUtf8Stream.js';
import lines from '../utils/lines.js';

// Raw per-line parser factory — no `fixUtf8Stream()` / `lines()` front. Parallel
// to the JSON tokenizer's `jsonParser` raw export; advanced callers compose the
// input front themselves when chunks already arrive line-aligned.
const jsonlParser = options => {
  const reviver = typeof options == 'function' ? options : options?.reviver;
  const hasErrorIndicator = !!options && 'errorIndicator' in options;
  let counter = 0;

  // `'errorIndicator' in options` is presence-check, so `errorIndicator: undefined`
  // is meaningful (drop bad lines); `errorIndicator: null` replaces them with null.
  // Wins over `ignoreErrors` when both are set. The indicator never changes, so the
  // function-form vs constant-form branch is picked once here, not per line.
  if (hasErrorIndicator) {
    const errorIndicator = options.errorIndicator;
    if (typeof errorIndicator == 'function') {
      // A function `errorIndicator` is invoked as `(error, input, reviver)`; its
      // return replaces the line (returning `undefined` drops it).
      return string => {
        if (!string) return none;
        let value;
        try {
          value = JSON.parse(string, reviver);
        } catch (error) {
          value = errorIndicator(error, string, reviver);
        }
        return value === undefined ? none : {key: counter++, value};
      };
    }
    // A non-function `errorIndicator` replaces the failed line as-is.
    return string => {
      if (!string) return none;
      let value;
      try {
        value = JSON.parse(string, reviver);
      } catch (_) {
        value = errorIndicator;
      }
      return value === undefined ? none : {key: counter++, value};
    };
  }

  if (options?.ignoreErrors) {
    return string => {
      if (!string) return none;
      try {
        return {key: counter++, value: JSON.parse(string, reviver)};
      } catch (_) {
        return none;
      }
    };
  }
  return string => {
    if (!string) return none;
    return {key: counter++, value: JSON.parse(string, reviver)};
  };
};

const parser = options => gen(fixUtf8Stream(), lines(), jsonlParser(options));

parser.parser = parser;
parser.jsonlParser = jsonlParser;

export default parser;
export {parser, jsonlParser};
