// @ts-self-types="./parserWebStream.d.ts"

import asWebStream from '../asWebStream.js';
import parser from './parser.js';

const parserWebStream = options => {
  const reviver = options?.reviver,
    ignoreErrors = options?.ignoreErrors,
    hasErrorIndicator = !!options && 'errorIndicator' in options,
    parserOptions = hasErrorIndicator
      ? {reviver, ignoreErrors, errorIndicator: options.errorIndicator}
      : {reviver, ignoreErrors};
  return asWebStream(parser(parserOptions), options);
};

export default parserWebStream;
export {parserWebStream};
