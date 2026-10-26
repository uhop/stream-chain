// @ts-self-types="./parserWebStream.d.ts"

import asWebStream from '../asWebStream.js';
import parser from './parser.js';

const parserWebStream = options => {
  const reviver = options?.reviver,
    ignoreErrors = options?.ignoreErrors,
    ignoreBOM = options?.ignoreBOM,
    hasErrorIndicator = !!options && 'errorIndicator' in options,
    parserOptions = hasErrorIndicator
      ? {reviver, ignoreErrors, ignoreBOM, errorIndicator: options.errorIndicator}
      : {reviver, ignoreErrors, ignoreBOM};
  return asWebStream(parser(parserOptions), options);
};

export default parserWebStream;
export {parserWebStream};
