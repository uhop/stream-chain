// @ts-self-types="./takeWithSkip.d.ts"

'use strict';

const {none} = require('../defs');

const takeWithSkip = (n, skip = 0, finalValue = none) => value =>
  skip > 0 ? (--skip, none) : n > 0 ? (--n, value) : finalValue;

module.exports = takeWithSkip;
