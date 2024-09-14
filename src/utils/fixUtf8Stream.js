// @ts-self-types="./fixUtf8Stream.d.ts"

'use strict';

const {StringDecoder} = require('string_decoder');

const {none, flushable} = require('../defs');

const fixUtf8Stream = () => {
  const stringDecoder = new StringDecoder();
  let input = '';
  return flushable(chunk => {
    if (chunk === none) {
      const result = input + stringDecoder.end();
      input = '';
      return result;
    }
    if (typeof chunk == 'string') {
      if (!input) return chunk;
      const result = input + chunk;
      input = '';
      return result;
    }
    if (chunk instanceof Buffer) {
      const result = input + stringDecoder.write(chunk);
      input = '';
      return result;
    }
    throw new TypeError('Expected a string or a Buffer');
  });
};

module.exports = fixUtf8Stream;
