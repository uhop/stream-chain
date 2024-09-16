export declare const none: unique symbol;
export declare const stop: unique symbol;
export declare const finalSymbol: unique symbol;
export declare const manySymbol: unique symbol;
export declare const flushSymbol: unique symbol;
export declare const fListSymbol: unique symbol;

export declare class Stop extends Error {}

export interface FinalValue<T = any> {
  [finalSymbol]: 1;
  value: T;
}
export declare function isFinalValue(o: object): o is FinalValue;
export declare function finalValue<T>(value: T): FinalValue<T>;
export declare function getFinalValue<T>(o: FinalValue<T>): T;
export declare const final = finalValue;

export interface Many<T = any> {
  [manySymbol]: 1;
  values: T[];
}
export declare function isMany(o: object): o is Many;
export declare function many<T>(values: T[]): Many<T>;
export declare function getManyValues<T>(o: Many<T>): T[];

export interface Flushable<I = any, O = unknown> {
  (value: I, ...rest: any[]): O;
  [flushSymbol]: 1;
}
export declare function isFlushable<I = any, O = unknown>(
  o: (value: I, ...rest: any[]) => O
): o is Flushable<I, O>;
export declare function flushable<I, O>(
  write: (value: I, ...rest: any[]) => O,
  final?: () => O
): Flushable<I, O>;

export interface FunctionList<
  T extends (...args: readonly any[]) => unknown,
  I = any,
  O = unknown
> {
  (value: I, ...rest: any[]): O;
  [fListSymbol]: 1;
  fList: T[];
}
export declare function isFunctionList<I, O>(
  o: (value: I, ...rest: readonly any[]) => O
): o is FunctionList<(...args: readonly any[]) => unknown, I, O>;
export declare function setFunctionList<
  T extends (...args: readonly any[]) => unknown,
  F extends (...args: readonly any[]) => unknown
>(
  o: F,
  fns: T[]
): F extends (value: infer I, ...rest: any[]) => infer O ? FunctionList<T, I, O> : never;
export declare function getFunctionList<T extends (...args: readonly any[]) => unknown>(
  o: FunctionList<T>
): T[];
export declare function clearFunctionList<F>(
  o: F
): F extends (value: infer I, ...rest: any[]) => infer O ? (value: I, ...rest: any[]) => O : never;

// generic utilities: unpacking types

export type UnpackReturnType<F extends (...args: readonly any[]) => unknown> =
  ReturnType<F> extends Promise<unknown>
    ? Awaited<ReturnType<F>>
    : ReturnType<F> extends AsyncGenerator<infer O, unknown, unknown>
    ? O
    : ReturnType<F> extends Generator<infer O, unknown, unknown>
    ? O
    : ReturnType<F>;

export type UnpackType<T> = T extends Many<infer U>
  ? U
  : T extends FinalValue<infer U>
  ? U
  : Exclude<T, typeof none | typeof stop>;

export type OutputType<F extends function> = UnpackType<UnpackReturnType<F>>;

// generic utilities: working with tuples

export type First<L extends readonly unknown[]> = L extends readonly [
  infer T,
  ...(readonly unknown[])
]
  ? T
  : never;
export type Last<L extends readonly unknown[]> = L extends readonly [
  ...(readonly unknown[]),
  infer T
]
  ? T
  : never;
export type Flatten<L extends readonly unknown[]> = L extends readonly [infer T, ...infer R]
  ? T extends readonly unknown[]
    ? readonly [...Flatten<T>, ...Flatten<R>]
    : readonly [T, ...Flatten<R>]
  : L;

export type Filter<L extends readonly unknown[], X> = L extends readonly [infer T, ...infer R]
  ? T extends X
    ? Filter<R, X>
    : readonly [T, ...Filter<R, X>]
  : L;

export type AsFlatList<L extends readonly unknown[]> = Filter<Flatten<L>, null | undefined>;

// generic utilities: working with functions

export type Fn = (arg: any, ...args: readonly unknown[]) => unknown;

export type Arg0<F> = F extends readonly unknown[]
  ? AsFlatList<F> extends readonly [infer F1, ...(readonly unknown[])]
    ? Arg0<F1>
    : AsFlatList<F> extends readonly []
    ? any
    : AsFlatList<F> extends readonly (infer F1)[]
    ? Arg0<F1>
    : never
  : F extends (...args: readonly any[]) => unknown
  ? Parameters<F>[0]
  : never;

export type Ret<F, Default = any> = F extends readonly unknown[]
  ? AsFlatList<F> extends readonly [...unknown[], infer F1]
    ? Ret<F1, Default>
    : AsFlatList<F> extends readonly []
    ? Default
    : AsFlatList<F> extends readonly (infer F1)[]
    ? Ret<F1, Default>
    : never
  : F extends Fn
  ? OutputType<F>
  : never;
