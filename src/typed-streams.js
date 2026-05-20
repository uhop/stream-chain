// @ts-self-types="./typed-streams.d.ts"

import {Duplex, Readable, Transform, Writable} from 'node:stream';

class TypedDuplex extends Duplex {}
class TypedReadable extends Readable {}
class TypedTransform extends Transform {}
class TypedWritable extends Writable {}

export {TypedDuplex, TypedReadable, TypedTransform, TypedWritable};
