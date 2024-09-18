import {none} from '../defs';

export = batch;

/**
 * Batch values into arrays of `n` elements.
 */
type BatchOutput<T> = (value: T | typeof none) => (T[] | typeof none);

/**
 * Creates a function that batches values into arrays of `n` elements.
 * @param n number of elements in a batch
 * @returns a flushable function that batches values
 * @remarks The returned function is a {@link BatchOutput}. It collects values into batches (arrays) of `n` elements. The last batch can have less than `n` elements.
 */
declare function batch<T = any>(n?: number): BatchOutput<T>;
