// @ts-self-types="./parser.d.ts"

import {none} from '../defs.js';
import gen from '../gen.js';
import fixUtf8Stream from '../utils/fixUtf8Stream.js';
import lines from '../utils/lines.js';

const parse = reviver => string => JSON.parse(string, reviver);

const checkedParse = reviver => string => {
  try {
    return JSON.parse(string, reviver);
  } catch (_) {
    // squelch
    return none;
  }
};

const parser = options => {
  const reviver = (options && options.reviver) || options,
    ignoreErrors = options && options.ignoreErrors,
    parseFn = ignoreErrors ? checkedParse(reviver) : parse(reviver);
  let counter = 0;
  return gen(fixUtf8Stream(), lines(), string => ({key: counter++, value: parseFn(string)}));
};

export default parser;
export {parser};
