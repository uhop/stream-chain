import {test} from 'tape-six';

import chain, {asWebStream, gen, fun} from '../src/web/index.js';

// IsAny pattern (from test-typings-defs.ts): compile-time check that T is not `any`.
type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertNotAny<T> = IsAny<T> extends false ? true : never;
type AssertEquals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

test('/web typings: chain returns ChainWebStream with W/R inferred', t => {
  const c = chain([(x: number) => x * 2, (x: number) => x.toString()]);
  // Compile-time assertions (the cast pattern from test-typings-*.ts).

  type C = typeof c;
  // ChainWebStream should be inferred with W=number, R=string.
  const _w: AssertNotAny<C> = true;
  const _r: AssertEquals<ReturnType<C['__streamTypeW']>, number> = true;
  const _s: AssertEquals<ReturnType<C['__streamTypeR']>, string> = true;
  void _w;
  void _r;
  void _s;
  t.pass('chain<L> inferred ChainWebStream<W, R> correctly');
});

test('/web typings: ChainWebStream readable side carries R', t => {
  const c = chain([(x: number) => x + 1]);
  // c.readable: ReadableStream<number> | null
  const _read: AssertEquals<NonNullable<typeof c.readable>, ReadableStream<number>> = true;
  void _read;
  t.pass('readable side carries R');
});

test('/web typings: ChainWebStream writable side carries W', t => {
  const c = chain([(x: string) => x.length]);
  // c.writable: WritableStream<string> | null
  const _write: AssertEquals<NonNullable<typeof c.writable>, WritableStream<string>> = true;
  void _write;
  t.pass('writable side carries W (no phantom needed — Web Streams permit it)');
});

test('/web typings: asWebStream(fn) returns TransformStream<W, R>', t => {
  const ts = asWebStream((x: number) => x * 10);
  const _w: AssertEquals<typeof ts.writable, WritableStream<number>> = true;
  const _r: AssertEquals<typeof ts.readable, ReadableStream<number>> = true;
  void _w;
  void _r;
  t.pass('asWebStream(fn) → TransformStream<W, R>');
});

test('/web typings: asWebStream passes Web stream objects through (identity)', t => {
  const r: ReadableStream<number> = new ReadableStream();
  const passed = asWebStream(r);
  const _id: AssertEquals<typeof passed, ReadableStream<number>> = true;
  void _id;
  t.pass('asWebStream(ReadableStream) → same type');
});

test('/web typings: gen and fun re-exported from /web', t => {
  const _gen: AssertNotAny<typeof gen> = true;
  const _fun: AssertNotAny<typeof fun> = true;
  void _gen;
  void _fun;
  t.pass('gen and fun typed and exported');
});
