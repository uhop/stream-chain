import test from 'tape-six';

import chain, {gen, asStream, none, finalValue} from '../src/index.js';
import fun from '../src/fun.js';
import readableFrom from '../src/utils/readableFrom.js';
import type {Many} from '../src/defs.js';

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertNotAny<T, Label extends string = 'value is any'> = IsAny<T> extends false ? 'ok' : Label;
type ChunkOf<C> = C extends {[Symbol.asyncIterator](): AsyncIterator<infer X>} ? X : never;

test.asPromise('typings gen: typed pipeline', (t, resolve) => {
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

test.asPromise('typings gen: async function in pipeline', (t, resolve) => {
  const output: string[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      async (x: number) => x * x,
      (x: number) => String(x)
    )
  ]);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings gen: generator function in pipeline', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(function* (x: number) {
      yield x;
      yield x * x;
    })
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 3, 9]);
    resolve();
  });
});

test.asPromise('typings gen: none filters values', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3, 4, 5]),
    gen(
      (x: number) => x * x,
      (x: number) => (x > 5 ? x : none)
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [9, 16, 25]);
    resolve();
  });
});

test.asPromise('typings gen: finalValue skips rest', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      (x: number) => finalValue(x),
      (x: number) => 2 * x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings gen: null passthrough', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      null,
      (x: number) => x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });
});

test.asPromise('typings gen: identity', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), gen()]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('typings fun: typed pipeline', async (t, resolve) => {
  const fn = fun(
    (x: number) => x * x,
    (x: number) => 2 * x + 1
  );

  const result = await fn(3);
  t.deepEqual(result.values, [19]);
  resolve();
});

test.asPromise('typings fun: async pipeline', async (t, resolve) => {
  const fn = fun(
    async (x: number) => x * x,
    (x: number) => String(x)
  );

  const result = await fn(3);
  t.deepEqual(result.values, ['9']);
  resolve();
});

test.asPromise('typings fun: identity', async (t, resolve) => {
  const fn = fun();
  const result = await fn(42);
  t.deepEqual(result.values, [42]);
  resolve();
});

test('typings fun: fun-of-fun — return shape stays Many<R> | Promise<Many<R>> (no pollution)', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const i2s = (n: number) => `value: ${n}`;
    const s2b = (s: string) => s !== '';
    const b2s = (b: boolean) => String(b);

    const f1 = fun(i2s, s2b, b2s);
    const f2 = fun((b: boolean) => (b ? 1 : 0), f1);

    // Argument: nested fun's input becomes f2's input.
    const _f2_arg: AssertNotAny<Parameters<typeof f2>[0], 'fun-of-fun arg: any'> = ok;
    void _f2_arg;
    const _f2_b: boolean = null as unknown as Parameters<typeof f2>[0];
    void _f2_b;

    // Return: must collapse to Many<string> | Promise<Many<string>>, not the
    // Many<string | Promise<Many<string>>> | Promise<...> pollution that occurred
    // before UnpackReturnType was made naked-T distributive.
    const _f2_ret: Many<string> | Promise<Many<string>> = f2(true);
    void _f2_ret;
  };
  void _check;
  t.pass();
});

test('typings gen: gen-of-gen — AsyncGenerator<R> propagates through outer gen', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const i2s = (n: number) => `value: ${n}`;
    const s2b = (s: string) => s !== '';
    const b2s = (b: boolean) => String(b);

    const g1 = gen(i2s, s2b, b2s);
    const g2 = gen((b: boolean) => (b ? 1 : 0), g1);

    const _g2_arg: AssertNotAny<Parameters<typeof g2>[0], 'gen-of-gen arg: any'> = ok;
    void _g2_arg;
    const _g2_b: boolean = null as unknown as Parameters<typeof g2>[0];
    void _g2_b;
    const _g2_ret: AsyncGenerator<string, void, unknown> = g2(true);
    void _g2_ret;
  };
  void _check;
  t.pass();
});

test('typings chain: chain([fn, fun(...)]) — R unwraps Many<R> | Promise<Many<R>> cleanly', t => {
  // Compile-time only. Regression guard: previously chain's R came out as
  // `R | Promise<Many<R>>` because UnpackReturnType didn't distribute over fun's
  // `Many<R> | Promise<Many<R>>` return-shape union.
  const _check = () => {
    const ok = 'ok' as const;
    const i2s = (n: number) => `value: ${n}`;
    const s2b = (s: string) => s !== '';
    const b2s = (b: boolean) => String(b);

    const f1 = fun(i2s, s2b, b2s);
    const c = chain([(b: boolean) => (b ? 1 : 0), f1]);

    const _chunk_t: string = null as unknown as ChunkOf<typeof c>;
    void _chunk_t;
    c.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain+fun on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

test('typings chain: chain([fn, gen(...)]) — R extracted from AsyncGenerator', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const i2s = (n: number) => `value: ${n}`;
    const s2b = (s: string) => s !== '';
    const b2s = (b: boolean) => String(b);

    const g1 = gen(i2s, s2b, b2s);
    const c = chain([(b: boolean) => (b ? 1 : 0), g1]);

    const _chunk_t: string = null as unknown as ChunkOf<typeof c>;
    void _chunk_t;
    c.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain+gen on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

test('typings chain: chain([fn, asStream(fn2)]) — R comes from the TypedDuplex', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const as1 = asStream((n: number) => `v${n}`);
    const c = chain([(b: boolean) => (b ? 1 : 0), as1]);

    const _chunk_t: string = null as unknown as ChunkOf<typeof c>;
    void _chunk_t;
    c.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain+asStream on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

// --- Composition-matrix coverage: pipe-like items in first position + cross-type pairings.
//   Compile-time only; complements the chain-of-X/fun-of-fun/gen-of-gen guards above.

test('typings chain: pipe-like items in first position (fun/gen/asStream)', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const f1 = fun((n: number) => `s${n}`);
    const g1 = gen((n: number) => `s${n}`);
    const as1 = asStream((n: number) => `s${n}`);

    // (A) chain([fun(...), fn]) — Arg0 walks into fun's `(arg) => Many<R>|Promise<Many<R>>`
    //     and recovers `arg: number`; outer R = next stage's return type.
    const cA = chain([f1, (s: string) => s.length]);
    const _cA_chunk: number = null as unknown as ChunkOf<typeof cA>;
    void _cA_chunk;
    cA.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[fun,fn] on(data): any'> = ok;
      void _;
    });

    // (B) chain([gen(...), fn]) — Arg0 walks into gen's `(arg) => AsyncGenerator<R>`.
    const cB = chain([g1, (s: string) => s.length]);
    const _cB_chunk: number = null as unknown as ChunkOf<typeof cB>;
    void _cB_chunk;
    cB.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[gen,fn] on(data): any'> = ok;
      void _;
    });

    // (C) chain([asStream(fn), fn]) — Arg0 hits the TypedDuplex branch on the first item.
    const cC = chain([as1, (s: string) => s.length]);
    const _cC_chunk: number = null as unknown as ChunkOf<typeof cC>;
    void _cC_chunk;
    cC.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[asStream,fn] on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

test('typings fun: cross-type composition (gen/fun in both positions)', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const f_inner = fun((n: number) => `s${n}`);
    const g_inner = gen((n: number) => `s${n}`);

    // (D) fun(fun(...), fn) — inner fun's input becomes outer fun's input.
    const fD = fun(f_inner, (s: string) => s.length);
    const _fD_arg: number = null as unknown as Parameters<typeof fD>[0];
    void _fD_arg;
    const _fD_ret: Many<number> | Promise<Many<number>> = fD(0);
    void _fD_ret;
    const _fD_notAny: AssertNotAny<Parameters<typeof fD>[0], 'fun[fun,fn] arg: any'> = ok;
    void _fD_notAny;

    // (E) fun(fn, gen(...)) — gen's AsyncGenerator<R> unwraps cleanly through outer fun's Ret.
    const fE = fun((b: boolean) => (b ? 1 : 0), g_inner);
    const _fE_arg: boolean = null as unknown as Parameters<typeof fE>[0];
    void _fE_arg;
    const _fE_ret: Many<string> | Promise<Many<string>> = fE(true);
    void _fE_ret;

    // (F) fun(gen(...), fn) — inner gen's input is the outer fun's input.
    const fF = fun(g_inner, (s: string) => s.length);
    const _fF_arg: number = null as unknown as Parameters<typeof fF>[0];
    void _fF_arg;
    const _fF_ret: Many<number> | Promise<Many<number>> = fF(0);
    void _fF_ret;
  };
  void _check;
  t.pass();
});

test('typings gen: cross-type composition (fun/gen in both positions)', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const f_inner = fun((n: number) => `s${n}`);
    const g_inner = gen((n: number) => `s${n}`);

    // (G) gen(gen(...), fn) — inner gen's input becomes outer gen's input.
    const gG = gen(g_inner, (s: string) => s.length);
    const _gG_arg: number = null as unknown as Parameters<typeof gG>[0];
    void _gG_arg;
    const _gG_ret: AsyncGenerator<number, void, unknown> = gG(0);
    void _gG_ret;

    // (H) gen(fn, fun(...)) — inner fun's Many<R>|Promise<Many<R>> unwraps through outer gen's Ret.
    const gH = gen((b: boolean) => (b ? 1 : 0), f_inner);
    const _gH_arg: boolean = null as unknown as Parameters<typeof gH>[0];
    void _gH_arg;
    const _gH_ret: AsyncGenerator<string, void, unknown> = gH(true);
    void _gH_ret;
    const _gH_notAny: AssertNotAny<Parameters<typeof gH>[0], 'gen[fn,fun] arg: any'> = ok;
    void _gH_notAny;

    // (I) gen(fun(...), fn) — inner fun's input is the outer gen's input.
    const gI = gen(f_inner, (s: string) => s.length);
    const _gI_arg: number = null as unknown as Parameters<typeof gI>[0];
    void _gI_arg;
    const _gI_ret: AsyncGenerator<number, void, unknown> = gI(0);
    void _gI_ret;
  };
  void _check;
  t.pass();
});

// --- Middle-position threading: pipe-like in a middle slot must consume the prior
//   stage's output (via ChainList/FnList's `Ret<F1, I>` walk) AND produce a value
//   that feeds the next stage cleanly. Outer Arg0 / Ret are pinned by the
//   bookend stages — TS errors at the middle item if threading breaks.

test('typings chain: pipe-like items in middle position (fun/gen/asStream/chain)', t => {
  const _check = () => {
    const ok = 'ok' as const;

    // Middle pipe-likes that consume `string` and produce `boolean`.
    const f_mid = fun((s: string) => s.length > 3);
    const g_mid = gen((s: string) => s.length > 3);
    const as_mid = asStream((s: string) => s.length > 3);
    const ch_mid = chain([(s: string) => s.length, (n: number) => n > 3]);

    // (L) chain with fun(...) in middle.
    const cL = chain([(n: number) => `s${n}`, f_mid, (b: boolean) => Number(b)]);
    const _cL_chunk: number = null as unknown as ChunkOf<typeof cL>;
    void _cL_chunk;
    cL.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[fn,fun,fn] on(data): any'> = ok;
      void _;
    });

    // (M) chain with gen(...) in middle.
    const cM = chain([(n: number) => `s${n}`, g_mid, (b: boolean) => Number(b)]);
    const _cM_chunk: number = null as unknown as ChunkOf<typeof cM>;
    void _cM_chunk;
    cM.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[fn,gen,fn] on(data): any'> = ok;
      void _;
    });

    // (N) chain with asStream(fn) in middle.
    const cN = chain([(n: number) => `s${n}`, as_mid, (b: boolean) => Number(b)]);
    const _cN_chunk: number = null as unknown as ChunkOf<typeof cN>;
    void _cN_chunk;
    cN.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[fn,asStream,fn] on(data): any'> = ok;
      void _;
    });

    // (O) chain with nested chain(...) in middle.
    const cO = chain([(s: string) => s.length, ch_mid, (b: boolean) => Number(b)]);
    const _cO_chunk: number = null as unknown as ChunkOf<typeof cO>;
    void _cO_chunk;
    cO.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'chain[fn,chain,fn] on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});

test('typings fun: pipe-like items in middle position (fun/gen)', t => {
  const _check = () => {
    const f_mid = fun((s: string) => s.length > 3);
    const g_mid = gen((s: string) => s.length > 3);

    // (P) fun(fn, fun(...), fn) — middle fun consumes string, outputs boolean.
    const fP = fun(
      (n: number) => `s${n}`,
      f_mid,
      (b: boolean) => Number(b)
    );
    const _fP_arg: number = null as unknown as Parameters<typeof fP>[0];
    void _fP_arg;
    const _fP_ret: Many<number> | Promise<Many<number>> = fP(0);
    void _fP_ret;

    // (Q) fun(fn, gen(...), fn) — middle gen consumes string, outputs boolean.
    const fQ = fun(
      (n: number) => `s${n}`,
      g_mid,
      (b: boolean) => Number(b)
    );
    const _fQ_arg: number = null as unknown as Parameters<typeof fQ>[0];
    void _fQ_arg;
    const _fQ_ret: Many<number> | Promise<Many<number>> = fQ(0);
    void _fQ_ret;
  };
  void _check;
  t.pass();
});

test('typings gen: pipe-like items in middle position (fun/gen)', t => {
  const _check = () => {
    const f_mid = fun((s: string) => s.length > 3);
    const g_mid = gen((s: string) => s.length > 3);

    // (R) gen(fn, fun(...), fn) — middle fun consumes string, outputs boolean.
    const gR = gen(
      (n: number) => `s${n}`,
      f_mid,
      (b: boolean) => Number(b)
    );
    const _gR_arg: number = null as unknown as Parameters<typeof gR>[0];
    void _gR_arg;
    const _gR_ret: AsyncGenerator<number, void, unknown> = gR(0);
    void _gR_ret;

    // (S) gen(fn, gen(...), fn) — middle gen consumes string, outputs boolean.
    const gS = gen(
      (n: number) => `s${n}`,
      g_mid,
      (b: boolean) => Number(b)
    );
    const _gS_arg: number = null as unknown as Parameters<typeof gS>[0];
    void _gS_arg;
    const _gS_ret: AsyncGenerator<number, void, unknown> = gS(0);
    void _gS_ret;
  };
  void _check;
  t.pass();
});

test('typings asStream: wrapping fun/gen-returned functions', t => {
  const _check = () => {
    const ok = 'ok' as const;
    const f_inner = fun((n: number) => `s${n}`);
    const g_inner = gen((n: number) => `s${n}`);

    // (J) asStream(fun(...)) — TypedDuplex<W, R> picks up W from fun's input,
    //     R from fun's (now cleanly unwrapped) Many<R>|Promise<Many<R>> return.
    const sJ = asStream(f_inner);
    const _sJ_R: string = null as unknown as ChunkOf<typeof sJ>;
    void _sJ_R;
    sJ.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'asStream(fun) on(data): any'> = ok;
      void _;
    });

    // (K) asStream(gen(...)) — TypedDuplex<W, R> picks up R from gen's AsyncGenerator<R>.
    const sK = asStream(g_inner);
    const _sK_R: string = null as unknown as ChunkOf<typeof sK>;
    void _sK_R;
    sK.on('data', chunk => {
      const _: AssertNotAny<typeof chunk, 'asStream(gen) on(data): any'> = ok;
      void _;
    });
  };
  void _check;
  t.pass();
});
