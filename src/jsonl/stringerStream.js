// @ts-self-types="./stringerStream.d.ts"

'use strict';

const {Transform} = require('node:stream');

const stringer = options => {
  let first = true,
    prefix = '',
    suffix = '',
    separator = '\n',
    emptyValue,
    replacer,
    space;
  if (options) {
    if (typeof options.prefix == 'string') prefix = options.prefix;
    if (typeof options.suffix == 'string') suffix = options.suffix;
    if (typeof options.separator == 'string') separator = options.separator;
    if (typeof options.emptyValue == 'string') emptyValue = options.emptyValue;
    replacer = options.replacer;
    space = options.space;
  }
  return new Transform(
    Object.assign({writableObjectMode: true}, options, {
      transform(value, _, callback) {
        let result = JSON.stringify(value, replacer, space);
        if (first) {
          first = false;
          result = prefix + result;
        } else {
          result = separator + result;
        }
        this.push(result);
        callback(null);
      },
      flush(callback) {
        let output;
        if (first) {
          output = typeof emptyValue == 'string' ? emptyValue : prefix + suffix;
        } else {
          output = suffix;
        }
        output && this.push(output);
        callback(null);
      }
    })
  );
};

module.exports = stringer;
