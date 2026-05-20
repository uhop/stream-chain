// @ts-self-types="./skip.d.ts"

import {none} from '../defs.js';

const skip = n => value => (n > 0 ? (--n, none) : value);

export default skip;
export {skip};
