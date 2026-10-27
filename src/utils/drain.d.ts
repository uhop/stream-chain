/**
 * Drains an async iterable, returning its last yielded value (or `undefined`
 * if it yielded nothing). A `Stop` from a `pipe()` run ends the drain normally: the
 * run has flushed and has nothing more to feed. Any other error propagates, and so
 * does a `Stop` from any other iterable, a `gen()` run included, whose caller needs it
 * to stop feeding.
 */
declare function drain<T>(g: AsyncIterable<T>): Promise<T | undefined>;

export default drain;
export {drain};
