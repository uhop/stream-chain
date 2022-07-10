'use strict';

const gen = require('../gen');
const asStream = require('../asStream');
const fixUtf8Stream = require('../utils/fixUtf8Stream');
const lines = require('../utils/lines');

const parse = reviver => string => JSON.parse(string, reviver);

const parser = options =>
  asStream(
    gen(fixUtf8Stream(), lines(), parse(options && options.reviver)),
    Object.assign({writableObjectMode: false, readableObjectMode: true}, options)
  );

parser.parse = parse;

module.exports = parser;

// to keep ESM happy
module.exports.parse = parse;
