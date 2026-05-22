// @ts-self-types="./parserStream.d.ts"

import asStream from '../asStream.js';
import parser from './parser.js';

const parserStream = options => {
  const reviver = options?.reviver,
    ignoreErrors = options?.ignoreErrors;
  return asStream(parser({reviver, ignoreErrors}), {
    writableObjectMode: false,
    readableObjectMode: true,
    ...options
  });
};

export default parserStream;
export {parserStream};
