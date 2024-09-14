// @ts-self-types="./skip.d.ts"

'use strict';

const {none} = require('../defs');

const skip = n => value => (n > 0 ? (--n, none) : value);

module.exports = skip;
