// @ts-self-types="./takeWithSkip.d.ts"

import {none} from '../defs.js';

const takeWithSkip =
  (n, skip = 0, finalValue = none) =>
  value =>
    skip > 0 ? (--skip, none) : n > 0 ? (--n, value) : finalValue;

export default takeWithSkip;
export {takeWithSkip};
