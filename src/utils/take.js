// @ts-self-types="./take.d.ts"

import {none} from '../defs.js';

const take =
  (n, finalValue = none) =>
  value =>
    n > 0 ? (--n, value) : finalValue;

export default take;
export {take};
