// @ts-self-types="./typed-streams.d.ts"

import {Duplex, Readable, Transform, Writable} from 'node:stream';

module.exports.TypedDuplex = class TypedDuplex extends Duplex {};
module.exports.TypedReadable = class TypedReadable extends Readable {};
module.exports.TypedTransform = class TypedTransform extends Transform {};
module.exports.TypedWritable = class TypedWritable extends Writable {};
