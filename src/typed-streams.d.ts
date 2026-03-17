/// <reference types="node" />

import {Duplex, Readable, Transform, Writable} from 'node:stream';

/**
 * Technical class to add input/output types to duplex streams.
 */
export declare class TypedDuplex<W = unknown, R = W> extends Duplex {
  __streamTypeR(): R;
  __streamTypeW(): W;
}

/**
 * Technical class to add output type to readable streams.
 */
export declare class TypedReadable<R = unknown> extends Readable {
  __streamTypeR(): R;
}

/**
 * Technical class to add input/output types to transform streams.
 */
export declare class TypedTransform<W = unknown, R = W> extends Transform {
  __streamTypeR(): R;
  __streamTypeW(): W;
}

/**
 * Technical class to add input type to writable streams.
 */
export declare class TypedWritable<W = unknown> extends Writable {
  __streamTypeW(): W;
}
