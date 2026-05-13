import test from 'tape-six';

import chain, {chainUnchecked, many, none, stop, finalValue, asStream, gen} from '../src/index.js';
import {TypedDuplex, TypedReadable, TypedTransform, TypedWritable} from '../src/typed-streams.js';
import readableFrom from '../src/utils/readableFrom.js';

import {Transform} from 'node:stream';

// Compile-time assertions that W/R type parameters propagate to runtime APIs (issue #47).
// Fails compile if `for await` / `on('data', cb)` / `.read()` leak back to `any`.
type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertNotAny<T, Label extends string = 'value is any'> = IsAny<T> extends false ? 'ok' : Label;

test.asPromise('typings chain: typed function chain', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    (x: number) => 2 * x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('typings chain: many and none', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => many([x, x * x]),
    (x: number) => (x % 2 ? x : none)
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 3, 9]);
    resolve();
  });
});

test.asPromise('typings chain: async function', (t, resolve) => {
  const output: string[] = [];
  const c = chain([readableFrom([1, 2, 3]), async (x: number) => String(x * x)] as const);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings chain: generator function', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    function* (x: number) {
      yield x;
      yield x * x;
    }
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 3, 9]);
    resolve();
  });
});

test.asPromise('typings chain: TypedTransform in chain', (t, resolve) => {
  const output: string[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    new TypedTransform<number, string>({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, String(x));
      }
    })
  ] as const);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings chain: untyped Transform in chain', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    new Transform({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, x * x);
      }
    })
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings chain: asStream wraps a function', (t, resolve) => {
  const output: boolean[] = [];
  const c = chain([readableFrom([1, 2, 3]), asStream((x: number) => x > 1)] as const);

  c.on('data', (data: boolean) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [false, true, true]);
    resolve();
  });
});

test.asPromise('typings chain: chainUnchecked', (t, resolve) => {
  const output: number[] = [];
  const c = chainUnchecked<number, number>([(x: number) => x * x, (x: number) => x + 1], {
    writableObjectMode: true,
    readableObjectMode: true
  });

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});

test.asPromise('typings chain: options', (t, resolve) => {
  const output: number[] = [];
  const c = chain([(x: number) => x * x] as const, {noGrouping: true});

  t.ok(c.streams.length > 0);
  t.ok(c.input);
  t.ok(c.output);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});

test.asPromise('typings chain: null and undefined passthrough', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    null,
    undefined,
    (x: number) => x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });
});

test.asPromise('typings chain: finalValue', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => finalValue(x * x),
    (x: number) => x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings chain: stop', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), (x: number) => (x > 2 ? stop : x)] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('typings chain: gen in chain', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      (x: number) => 2 * x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test('typings chain: ChainOutput<W, R> propagates R (issue #47)', t => {
  // Compile-time only — never runs the chain. Asserts that the inferred R
  // (= string here) flows through to for-await, on('data', cb), and read().
  const _check = () => {
    const c = chain([readableFrom([1, 2, 3]), (x: number) => String(x * x)] as const);
    const ok = 'ok' as const;
    const _r: AssertNotAny<ReturnType<typeof c.read>, 'chain read(): any'> = ok;
    void _r;
    c.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain on(data): any'> = ok;
      void _;
    });
    void (async () => {
      for await (const chunk of c) {
        const _: AssertNotAny<typeof chunk, 'chain for-await: any'> = ok;
        void _;
      }
    });
    // Inherited overloads must still resolve (regression guard).
    c.on('end', () => {});
    c.on('error', err => void err.message);
    // pipe contract preserved: readable.pipe(c) requires c to satisfy WritableStream.
    readableFrom([1, 2, 3]).pipe(c);
  };
  void _check;
  t.pass();
});

test('typings chain: chain-of-chain — W and R propagate through nested ChainOutput', t => {
  // Compile-time only. Regression guard for the bug where `Ret<L>` walked into
  // a nested `ChainOutput<W, R>` and hit the structural `Duplex` branch, losing R.
  // Now mirrors `TypedDuplex` via `__streamTypeW`/`__streamTypeR` phantoms.
  const _check = () => {
    const ok = 'ok' as const;
    const i2s = (n: number) => `value: ${n}`;
    const s2b = (s: string) => s !== '';
    const b2s = (b: boolean) => String(b);

    const c1 = chain([i2s, s2b, b2s]);
    const c3 = chain([(b: boolean) => (b ? 1 : 0), c1]);

    c3.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'nested-chain on(data): any'> = ok;
      void _;
    });
    void (async () => {
      for await (const chunk of c3) {
        const _: AssertNotAny<typeof chunk, 'nested-chain for-await: any'> = ok;
        void _;
      }
    });

    // Symmetric case: chain output as the FIRST item exercises `Arg0` recovery of W.
    const c4 = chain([c1, (s: string) => s.length]);
    c4.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'first-chain on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

test('typings chain: TypedReadable<R> / TypedDuplex<W,R> / TypedTransform<W,R> propagate R', t => {
  const _check = () => {
    const ok = 'ok' as const;

    const tr = new TypedReadable<{x: number}>({objectMode: true});
    const _tr: AssertNotAny<ReturnType<typeof tr.read>, 'TypedReadable read(): any'> = ok;
    void _tr;
    tr.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'TypedReadable on(data): any'> = ok;
      void _;
    });
    void (async () => {
      for await (const chunk of tr) {
        const _: AssertNotAny<typeof chunk, 'TypedReadable for-await: any'> = ok;
        void _;
      }
    });
    tr.on('end', () => {});

    const td = new TypedDuplex<string, number>({objectMode: true});
    const _td: AssertNotAny<ReturnType<typeof td.read>, 'TypedDuplex read(): any'> = ok;
    void _td;
    td.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'TypedDuplex on(data): any'> = ok;
      void _;
    });
    td.on('finish', () => {});

    const tt = new TypedTransform<number, string>({
      objectMode: true,
      transform(_x, _enc, callback) {
        callback(null, '');
      }
    });
    const _tt: AssertNotAny<ReturnType<typeof tt.read>, 'TypedTransform read(): any'> = ok;
    void _tt;
    tt.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'TypedTransform on(data): any'> = ok;
      void _;
    });

    // TypedWritable<W>: W stays phantom (pipe-compat); only writable-side events.
    const tw = new TypedWritable<number>({objectMode: true});
    tw.on('finish', () => {});
    void tw;
  };
  void _check;
  t.pass();
});
