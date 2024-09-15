/// <reference types="node" />

import {Duplex, Readable, Transform, Writable} from 'node:stream';

export class TypedDuplex<W = any, R = W> extends Duplex {
  __streamTypeR(): R;
  __streamTypeW(): W;
}

export class TypedReadable<R = any> extends Readable {
  __streamTypeR(): R;
}

export class TypedTransform<W = any, R = W> extends Transform {
  __streamTypeR(): R;
  __streamTypeW(): W;
}

export class TypedWritable<W = any> extends Writable {
  __streamTypeW(): W;
}

