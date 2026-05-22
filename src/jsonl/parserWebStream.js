// @ts-self-types="./parserWebStream.d.ts"

import asWebStream from '../asWebStream.js';
import parser from './parser.js';

const parserWebStream = options => {
  const reviver = options?.reviver,
    ignoreErrors = options?.ignoreErrors;
  return asWebStream(parser({reviver, ignoreErrors}), options);
};

export default parserWebStream;
export {parserWebStream};
