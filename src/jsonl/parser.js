// @ts-self-types="./parser.d.ts"

import {none} from '../defs.js';
import gen from '../gen.js';
import fixUtf8Stream from '../utils/fixUtf8Stream.js';
import lines from '../utils/lines.js';

// Standalone single-line parser. Behaves as plain `JSON.parse` unless the
// `errorIndicator` argument is provided; once provided, parse failures invoke
// the function form `errorIndicator(error, input, reviver)` (its return value
// replaces the line) or return the constant `errorIndicator` directly. Inside
// `jsonlParser` an explicit `errorIndicator: undefined` is the "drop bad lines"
// signal — `arguments.length` below preserves that asymmetry (a default value
// would collapse explicit-undefined into omission).
function checkedParse(input, reviver, errorIndicator) {
  if (arguments.length < 3) return JSON.parse(input, reviver);
  try {
    return JSON.parse(input, reviver);
  } catch (error) {
    if (typeof errorIndicator == 'function') return errorIndicator(error, input, reviver);
  }
  return errorIndicator;
}

// Raw per-line parser factory — no `fixUtf8Stream()` / `lines()` front. Parallel
// to the JSON tokenizer's `jsonParser` raw export; advanced callers compose the
// input front themselves when chunks already arrive line-aligned.
const jsonlParser = options => {
  const reviver = typeof options == 'function' ? options : options?.reviver;
  const ignoreErrors = options?.ignoreErrors;
  const hasErrorIndicator = !!options && 'errorIndicator' in options;
  const errorIndicator = options?.errorIndicator;
  let counter = 0;

  if (hasErrorIndicator) {
    // `'errorIndicator' in options` is presence-check, so `errorIndicator: undefined`
    // is meaningful (drop bad lines); `errorIndicator: null` replaces them with null.
    // Wins over `ignoreErrors` when both are set.
    return string => {
      if (!string) return none;
      const value = checkedParse(string, reviver, errorIndicator);
      return value === undefined ? none : {key: counter++, value};
    };
  }
  if (ignoreErrors) {
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
parser.checkedParse = checkedParse;

export default parser;
export {parser, jsonlParser, checkedParse};
