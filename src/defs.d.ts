/**
 * Special symbol that indicates that a function produced no value.
 * Effectively, the rest of the pipeline is not used.
 */
export declare const none: unique symbol;

/**
 * Special symbol that indicates that the pipeline should be stopped.
 * Just like {@link none}, it produces no value.
 */
export declare const stop: unique symbol;

/** Used internally to mark a value as a final value. */
export declare const finalSymbol: unique symbol;
/** Used internally to mark a value as multiple values. */
export declare const manySymbol: unique symbol;
/** Used internally to mark a function as capable of being flushed. */
export declare const flushSymbol: unique symbol;
/** Used internally to mark a function as being derived from a function list. */
export declare const fListSymbol: unique symbol;

/**
 * An exception that indicates that the pipeline should be stopped.
 */
export declare class Stop extends Error {}

/**
 * Interface for a value that has been marked as a final value.
 */
export interface FinalValue<T = any> {
  [finalSymbol]: 1;
  value: T;
}
/**
 * Type predicate for `FinalValue`.
 * @param o object to test
 * @returns `true` if `o` is a `FinalValue`
 */
export declare function isFinalValue(o: object): o is FinalValue;
/**
 * Creates a `FinalValue`
 * @param value the wrapped value
 * @returns a `FinalValue`
 */
export declare function finalValue<T>(value: T): FinalValue<T>;
/**
 * Retrieves the value of a `FinalValue`
 * @param o a `FinalValue` object
 * @returns the wrapped value
 */
export declare function getFinalValue<T>(o: FinalValue<T>): T;
/**
 * Alias for {@link finalValue}
 */
export declare const final = finalValue;

/**
 * Interface for a value that has been marked as multiple values.
 * It is used to return multiple values from a regular (non-generator) function.
 */
export interface Many<T = any> {
  [manySymbol]: 1;
  values: T[];
}
/**
 * Type predicate for `Many`.
 * @param o object to test
 * @returns `true` if `o` is a `Many`
 */
export declare function isMany(o: object): o is Many;
/**
 * Creates a `Many`
 * @param values the wrapped values
 * @returns a `Many`
 */
export declare function many<T>(values: T[]): Many<T>;
/**
 * Retrieves the values of a `Many`
 * @param o a `Many` object
 * @returns the wrapped values
 */
export declare function getManyValues<T>(o: Many<T>): T[];

/**
 * Interface for a function that can be flushed.
 * If it is marked as flushable, it will be called with the special {@link none} value
 * when the pipeline is stopped so it can produce the last value.
 */
export interface Flushable<I = any, O = unknown> {
  (value: I, ...rest: any[]): O;
  [flushSymbol]: 1;
}
/**
 * Type predicate for `Flushable`.
 * @param o function to test
 * @returns `true` if `o` is a `Flushable`
 */
export declare function isFlushable<I, O>(o: (value: I, ...rest: any[]) => O): o is Flushable<I, O>;
/**
 * Creates a `Flushable`
 * @param write function to be marked as flushable
 * @param final an optional function to be called when the pipeline is stopped
 * @returns a `Flushable`
 * @remarks If `final` is not provided, `write` will be called with {@link none} when the pipeline is stopped
 */
export declare function flushable<I, O>(
  write: (value: I, ...rest: any[]) => O,
  final?: () => O
): Flushable<I, O>;

/**
 * Interface for a function that can be derived from a function list.
 * `chain` can use the list instead of the original function.
 */
export interface FunctionList<
  T extends (...args: readonly any[]) => unknown,
  I = any,
  O = unknown
> {
  (value: I, ...rest: any[]): O;
  [fListSymbol]: 1;
  fList: T[];
}
/**
 * Type predicate for `FunctionList`.
 * @param o function to test
 * @returns `true` if `o` is a `FunctionList`
 */
export declare function isFunctionList<I, O>(
  o: (value: I, ...rest: readonly any[]) => O
): o is FunctionList<(...args: readonly any[]) => unknown, I, O>;
/**
 * Sets a function list creating a `FunctionList` structure.
 * @param o function to be marked as a function list
 * @param fns function list
 * @returns `o` as a `FunctionList`
 */
export declare function setFunctionList<
  T extends (...args: readonly any[]) => unknown,
  F extends (...args: readonly any[]) => unknown
>(
  o: F,
  fns: T[]
): F extends (value: infer I, ...rest: any[]) => infer O ? FunctionList<T, I, O> : never;
/**
 * Retrieves the function list of a `FunctionList`
 * @param o a `FunctionList` object
 * @returns the function list
 */
export declare function getFunctionList<
  T extends (...args: readonly any[]) => unknown,
  I = any,
  O = unknown
>(o: FunctionList<T, I, O>): T[];
/**
 * Clears the function list from a `FunctionList`
 * @param o a `FunctionList` object
 * @returns `o` as a `FunctionList`
 */
export declare function clearFunctionList<
  T extends (...args: readonly any[]) => unknown,
  I = any,
  O = unknown
>(o: FunctionList<T, I, O>): (value: I, ...rest: any[]) => O;

// generic utilities: unpacking types

/**
 * Generic utility for getting the return type of a function including async and generators.
 */
export type UnpackReturnType<F extends (...args: readonly any[]) => unknown> =
  ReturnType<F> extends Promise<unknown>
    ? Awaited<ReturnType<F>>
    : ReturnType<F> extends AsyncGenerator<infer O, unknown, unknown>
    ? O
    : ReturnType<F> extends Generator<infer O, unknown, unknown>
    ? O
    : ReturnType<F>;

/**
 * `stream-chain`-specific utility for getting the type from functions used in a function list.
 */
export type UnpackType<T> = T extends Many<infer U>
  ? U
  : T extends FinalValue<infer U>
  ? U
  : Exclude<T, typeof none | typeof stop>;

/**
 * Unpacking the return type of a function as a combination of {@link UnpackType} and {@link UnpackReturnType}.
 */
export type OutputType<F extends function> = UnpackType<UnpackReturnType<F>>;

// generic utilities: working with tuples

/**
 * Returns the first element of a tuple or `never`.
 */
export type First<L extends readonly unknown[]> = L extends readonly [
  infer T,
  ...(readonly unknown[])
]
  ? T
  : never;
/**
 * Returns the last element of a tuple or `never`.
 */
export type Last<L extends readonly unknown[]> = L extends readonly [
  ...(readonly unknown[]),
  infer T
]
  ? T
  : never;
/**
 * Flattens a tuple of tuples recursively returning a flat tuple.
 */
export type Flatten<L extends readonly unknown[]> = L extends readonly [infer T, ...infer R]
  ? T extends readonly unknown[]
    ? readonly [...Flatten<T>, ...Flatten<R>]
    : readonly [T, ...Flatten<R>]
  : L;
/**
 * Filters a tuple removing all elements of a specified type returning a filtered tuple.
 */
export type Filter<L extends readonly unknown[], X> = L extends readonly [infer T, ...infer R]
  ? T extends X
    ? Filter<R, X>
    : readonly [T, ...Filter<R, X>]
  : L;
/**
 * Flattens and filters a tuple. See {@link Flatten} and {@link Filter}.
 */
export type AsFlatList<L extends readonly unknown[]> = Filter<Flatten<L>, null | undefined>;

// generic utilities: working with functions

/**
 * A generic one-argument function. Used internally.
 */
export type Fn = (arg: any, ...args: readonly unknown[]) => unknown;

/**
 * Returns the first argument of a function or a function list or `never`.
 */
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

/**
 * Returns the unpacked return type of a function or a function list or `never`.
 */
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
