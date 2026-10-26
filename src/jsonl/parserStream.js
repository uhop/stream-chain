// @ts-self-types="./parserStream.d.ts"

import asStream from '../asStream.js';
import parser from './parser.js';

const parserStream = options => {
  const reviver = options?.reviver,
    ignoreErrors = options?.ignoreErrors,
    ignoreBOM = options?.ignoreBOM,
    hasErrorIndicator = !!options && 'errorIndicator' in options,
    parserOptions = hasErrorIndicator
      ? {reviver, ignoreErrors, ignoreBOM, errorIndicator: options.errorIndicator}
      : {reviver, ignoreErrors, ignoreBOM};
  return asStream(parser(parserOptions), {
    writableObjectMode: false,
    readableObjectMode: true,
    ...options
  });
};

export default parserStream;
export {parserStream};
