/// <reference types="node" />

import {Duplex, Readable, Transform, Writable} from 'node:stream';

/**
 * Technical class to add input/output types to duplex streams.
 */
export declare class TypedDuplex<W = any, R = W> extends Duplex {
  __streamTypeR(): R {
    return null as R;
  }
  __streamTypeW(): W {
    return null as W;
  }
}

/**
 * Technical class to add output type to readable streams.
 */
export declare class TypedReadable<R = any> extends Readable {
  __streamTypeR(): R {
    return null as R;
  }
}

/**
 * Technical class to add input/output types to transform streams.
 */
export declare class TypedTransform<W = any, R = W> extends Transform {
  __streamTypeR(): R {
    return null as R;
  }
  __streamTypeW(): W {
    return null as W;
  }
}

/**
 * Technical class to add input type to writable streams.
 */
export declare class TypedWritable<W = any> extends Writable {
  __streamTypeW(): W {
    return null as W;
  }
}
