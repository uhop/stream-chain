export const none: unique symbol;
export const stop: unique symbol;
export const finalSymbol: unique symbol;
export const manySymbol: unique symbol;
export const flushSymbol: unique symbol;
export const fListSymbol: unique symbol;

export class Stop extends Error {}

export function finalValue(value: any): {
  [finalSymbol]: 1;
  value: any;
};
export function isFinalValue(o: any): boolean;
export function getFinalValue(o: any): any | undefined;
export const final = finalValue;

export function many(values: any[]): {
  [manySymbol]: 1;
  values: any[];
};
export function isMany(o: any): boolean;
export function getManyValues(o: any): any[] | undefined;

type FlushableFn = (value: unknown) => unknown;
interface Flushable extends FlushableFn {
  [flushSymbol]: 1;
}

export function flushable(write: (value: unknown) => unknown, final?: () => unknown): Flushable;
export function isFlushable(o: any): boolean;

export function setFunctionList(o: any, fns: any[]): {
  [fListSymbol]: 1;
  fList: any[];
};
export function isFunctionList(o: any): boolean;
export function getFunctionList(o: any): any[] | undefined;
