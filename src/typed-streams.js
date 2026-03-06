// @ts-self-types="./typed-streams.d.ts"

'use strict';

const {Duplex, Readable, Transform, Writable} = require('node:stream');

class TypedDuplex extends Duplex {};
class TypedReadable extends Readable {};
class TypedTransform extends Transform {};
class TypedWritable extends Writable {};

module.exports = {TypedDuplex, TypedReadable, TypedTransform, TypedWritable};
