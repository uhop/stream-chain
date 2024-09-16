/// <reference types="node" />

import {Duplex, Readable, Transform, Writable} from 'node:stream';

export declare class TypedDuplex<W = any, R = W> extends Duplex {
  __streamTypeR(): R {
    return null as R;
  }
  __streamTypeW(): W {
    return null as W;
  }
}

export declare class TypedReadable<R = any> extends Readable {
  __streamTypeR(): R {
    return null as R;
  }
}

export declare class TypedTransform<W = any, R = W> extends Transform {
  __streamTypeR(): R {
    return null as R;
  }
  __streamTypeW(): W {
    return null as W;
  }
}

export declare class TypedWritable<W = any> extends Writable {
  __streamTypeW(): W {
    return null as W;
  }
}
