import type {Fn} from './defs.js';

/**
 * Coerces a function or iterable to a function. For an iterable returns the
 * function bound to `Symbol.asyncIterator` or `Symbol.iterator`; for a function
 * returns the argument unchanged. Substrate-agnostic — exported from `/node`,
 * `/web`, and `/core`.
 * @param fn function or iterable.
 * @returns the underlying function.
 * @throws `TypeError` if `fn` is neither a function nor an iterable.
 */
declare function dataSource<F>(
  fn: F
): F extends AsyncIterable<infer T>
  ? () => AsyncIterator<T>
  : F extends Iterable<infer T>
    ? () => Iterator<T>
    : F extends Fn
      ? F
      : never;

export default dataSource;
export {dataSource};
