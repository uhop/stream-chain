// @ts-self-types="./parserStream.d.ts"

'use strict';

const asStream = require('../asStream');
const parser = require('./parser.js');

const parserStream = options => {
  const reviver = options && options.reviver,
    ignoreErrors = options && options.ignoreErrors;
  return asStream(
    parser({reviver, ignoreErrors}),
    Object.assign({writableObjectMode: false, readableObjectMode: true}, options)
  );
};

module.exports = parserStream;
