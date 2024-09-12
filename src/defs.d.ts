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
  [flushSymbol]: 1;
  (value: I, ...rest: any[]): O;
}
export declare function isFlushable<I, O>(o: (value: I, ...rest: any[]) => O): o is Flushable<I, O>;
export declare function flushable<I, O>(
  write: (value: I, ...rest: any[]) => O,
  final?: () => O
): Flushable<I, O>;

export interface FunctionList<T extends function> {
  [fListSymbol]: 1;
  fList: T[];
}
export declare function isFunctionList(o: object): o is FunctionList;
export declare function setFunctionList<T extends function>(o: any, fns: T[]): FunctionList<T>;
export declare function getFunctionList<T extends function>(o: FunctionList<T>): T[];

// generic utilities: unpacking types

export type UnpackReturnType<F extends function> = ReturnType<F> extends Promise<infer O>
  ? O
  : ReturnType<F> extends AsyncGenerator<infer O, unknown, unknown>
  ? O
  : ReturnType<F> extends Generator<infer O, unknown, unknown>
  ? O
  : ReturnType<F>;

export type UnpackType<T> = T extends Many<infer U>
  ? U
  : T extends FinalValue<infer U>
  ? U
  : T extends typeof none
  ? void
  : T extends typeof stop
  ? void
  : T;

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
