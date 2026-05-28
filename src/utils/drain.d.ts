/**
 * Drains an async iterable, returning its last yielded value (or `undefined`
 * if it yielded nothing).
 */
declare function drain<T>(g: AsyncIterable<T>): Promise<T | undefined>;

export default drain;
export {drain};
