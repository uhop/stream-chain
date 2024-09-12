export declare const none: unique symbol;
export declare const stop: unique symbol;
export declare const finalSymbol: unique symbol;
export declare const manySymbol: unique symbol;
export declare const flushSymbol: unique symbol;
export declare const fListSymbol: unique symbol;

export declare class Stop extends Error {}

interface FinalValue<T = any> {
  [finalSymbol]: 1;
  value: T;
}
export declare function isFinalValue(o: object): o is FinalValue;
export declare function finalValue<T>(value: T): FinalValue<T>;
export declare function getFinalValue<T>(o: FinalValue<T>): T;
export declare const final = finalValue;

interface Many<T = any> {
  [manySymbol]: 1;
  values: T[];
}
export declare function isMany(o: object): o is Many;
export declare function many<T>(values: T[]): Many<T>;
export declare function getManyValues<T>(o: Many<T>): T[];

interface Flushable<I = any, O = unknown> {
  [flushSymbol]: 1;
  (value: I, ...rest: any[]): O;
}
export declare function isFlushable<I, O>(o: (value: I, ...rest: any[]) => O): o is Flushable<I, O>;
export declare function flushable<I, O>(
  write: (value: I, ...rest: any[]) => O,
  final?: () => O
): Flushable<I, O>;

interface FunctionList<T extends function> {
  [fListSymbol]: 1;
  fList: T[];
}
export declare function isFunctionList(o: object): o is FunctionList;
export declare function setFunctionList<T extends function>(o: any, fns: T[]): FunctionList<T>;
export declare function getFunctionList<T extends function>(o: FunctionList<T>): T[];
