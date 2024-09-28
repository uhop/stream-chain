// @ts-self-types="./parser.d.ts"

'use strict';

const {none} = require('../defs.js');
const gen = require('../gen.js');
const fixUtf8Stream = require('../utils/fixUtf8Stream');
const lines = require('../utils/lines');

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

module.exports = parser;
