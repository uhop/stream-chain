// @ts-self-types="./take.d.ts"

'use strict';

const {none} = require('../defs');

const take = (n, finalValue = none) => value => (n > 0 ? (--n, value) : finalValue);

module.exports = take;
