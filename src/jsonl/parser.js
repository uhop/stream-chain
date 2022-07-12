'use strict';

const gen = require('../gen.js');
const fixUtf8Stream = require('../utils/fixUtf8Stream');
const lines = require('../utils/lines');

const parser = reviver => {
  let counter = 0;
  return gen(fixUtf8Stream(), lines(), string => ({key: counter++, value: JSON.parse(string, reviver)}));
};

module.exports = parser;
