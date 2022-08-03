'use strict';

const gen = require('../gen');
const asStream = require('../asStream');
const fixUtf8Stream = require('../utils/fixUtf8Stream');
const lines = require('../utils/lines');

const parserStream = options => {
  const reviver = options && options.reviver;
  let counter = 0;
  return asStream(
    gen(fixUtf8Stream(), lines(), string => ({key: counter++, value: JSON.parse(string, reviver)})),
    Object.assign({writableObjectMode: false, readableObjectMode: true}, options)
  );
};

module.exports = parserStream;
