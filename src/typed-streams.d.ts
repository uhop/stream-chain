/// <reference types="node" />

import {Duplex, DuplexEventMap, Readable, ReadableEventMap, Transform, Writable} from 'node:stream';

// On the writable side, `W` is intentionally not propagated to `write`/`end` to keep
// the typed classes structurally compatible with `NodeJS.WritableStream` (which fixes
// `chunk: string | Uint8Array`); narrowing it there breaks `readable.pipe(typed)`.
// `W` survives as a phantom parameter (`__streamTypeW`) used by `chain<L>(...)`'s type
// inference. The read side is narrowed via the listener overloads below.

/**
 * Technical class to add input/output types to duplex streams.
 */
export declare class TypedDuplex<W = unknown, R = W> extends Duplex {
  __streamTypeR(): R;
  __streamTypeW(): W;

  read(size?: number): R;
  push(chunk: R | null, encoding?: BufferEncoding): boolean;
  [Symbol.asyncIterator](): NodeJS.AsyncIterator<R>;

  on(event: 'data', listener: (chunk: R) => void): this;
  on<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'data', listener: (chunk: R) => void): this;
  once<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;

  off(event: 'data', listener: (chunk: R) => void): this;
  off<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this;

  addListener(event: 'data', listener: (chunk: R) => void): this;
  addListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'data', listener: (chunk: R) => void): this;
  removeListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'data', listener: (chunk: R) => void): this;
  prependListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'data', listener: (chunk: R) => void): this;
  prependOnceListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'data', chunk: R): boolean;
  emit<E extends keyof DuplexEventMap>(eventName: E, ...args: DuplexEventMap[E]): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean;
}

/**
 * Technical class to add output type to readable streams.
 */
export declare class TypedReadable<R = unknown> extends Readable {
  __streamTypeR(): R;

  read(size?: number): R;
  push(chunk: R | null, encoding?: BufferEncoding): boolean;
  [Symbol.asyncIterator](): NodeJS.AsyncIterator<R>;

  on(event: 'data', listener: (chunk: R) => void): this;
  on<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'data', listener: (chunk: R) => void): this;
  once<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;

  off(event: 'data', listener: (chunk: R) => void): this;
  off<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this;

  addListener(event: 'data', listener: (chunk: R) => void): this;
  addListener<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'data', listener: (chunk: R) => void): this;
  removeListener<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'data', listener: (chunk: R) => void): this;
  prependListener<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'data', listener: (chunk: R) => void): this;
  prependOnceListener<E extends keyof ReadableEventMap>(
    eventName: E,
    listener: (...args: ReadableEventMap[E]) => void
  ): this;
  prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'data', chunk: R): boolean;
  emit<E extends keyof ReadableEventMap>(eventName: E, ...args: ReadableEventMap[E]): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean;
}

/**
 * Technical class to add input/output types to transform streams.
 */
export declare class TypedTransform<W = unknown, R = W> extends Transform {
  __streamTypeR(): R;
  __streamTypeW(): W;

  read(size?: number): R;
  push(chunk: R | null, encoding?: BufferEncoding): boolean;
  [Symbol.asyncIterator](): NodeJS.AsyncIterator<R>;

  on(event: 'data', listener: (chunk: R) => void): this;
  on<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'data', listener: (chunk: R) => void): this;
  once<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  once(eventName: string | symbol, listener: (...args: any[]) => void): this;

  off(event: 'data', listener: (chunk: R) => void): this;
  off<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this;

  addListener(event: 'data', listener: (chunk: R) => void): this;
  addListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  removeListener(event: 'data', listener: (chunk: R) => void): this;
  removeListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependListener(event: 'data', listener: (chunk: R) => void): this;
  prependListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  prependOnceListener(event: 'data', listener: (chunk: R) => void): this;
  prependOnceListener<E extends keyof DuplexEventMap>(
    eventName: E,
    listener: (...args: DuplexEventMap[E]) => void
  ): this;
  prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'data', chunk: R): boolean;
  emit<E extends keyof DuplexEventMap>(eventName: E, ...args: DuplexEventMap[E]): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean;
}

/**
 * Technical class to add input type to writable streams.
 */
export declare class TypedWritable<W = unknown> extends Writable {
  __streamTypeW(): W;
}
