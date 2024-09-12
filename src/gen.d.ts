export = Gen.gen;

declare namespace Gen {
  type First<L extends readonly unknown[]> = L extends readonly [infer T, ...readonly unknown[]] ? T : never;
  type Last<L extends readonly unknown[]> = L extends readonly [...readonly unknown[], infer T] ? T : never;
  type Flatten<L extends readonly unknown[]> = L extends readonly [infer T, ...infer R]
    ? T extends readonly unknown[]
      ? readonly [...Flatten<T>, ...Flatten<R>]
      : readonly [T, ...Flatten<R>]
    : L;

  type Fn<I = any, O = any> = (arg: I, ...rest: readonly unknown[]) => O;

  type Arg0<F> = F extends readonly unknown[]
    ? Flatten<F> extends readonly [infer F1, ...readonly unknown[]]
      ? Arg0<F1>
      : Flatten<F> extends readonly (infer F1)[]
      ? Arg0<F1>
      : never
    : F extends (...args: readonly any[]) => unknown
    ? Parameters<F>[0]
    : never;

  type Ret<F> = F extends readonly unknown[]
    ? Flatten<F> extends readonly [...unknown[], infer F1]
      ? Ret<F1>
      : never
    : F extends Fn
    ? ReturnType<F> extends Generator<infer O, unknown, unknown>
      ? O
      : ReturnType<F> extends AsyncGenerator<infer O, unknown, unknown>
      ? O
      : ReturnType<F> extends Promise<infer O>
      ? O
      : ReturnType<F>
    : never;

  type FnItem<I, F> = F extends readonly [infer F1, ...infer R]
    ? readonly [FnItem<I, F1>, ...FnList<Ret<F1>, R>]
    : F extends Fn<any, unknown>[]
    ? readonly [FnItem<I, F[number]>]
    : F extends Fn<any, unknown>
    ? I extends Arg0<F>
      ? F
      : (arg: I, ...rest: unknown[]) => ReturnType<F>
    : never;

  type FnList<I, L> = L extends readonly [infer F1, ...infer R] ? readonly [FnItem<I, F1>, ...FnList<Ret<F1>, R>] : L;

  function gen(): (arg: any) => AsyncGenerator<any, void, unknown>;
  function gen<L extends unknown[]>(
    ...fns: FnList<Arg0<L>, L>
  ): Flatten<L> extends readonly [Fn, ...Fn[]]
    ? (arg: Arg0<L>) => AsyncGenerator<Ret<L>, void, unknown>
    : Flatten<L> extends Fn[]
    ? (arg: any) => AsyncGenerator<any, void, unknown>
    : never;
}
