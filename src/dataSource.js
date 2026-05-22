// @ts-self-types="./dataSource.d.ts"

const dataSource = fn => {
  if (typeof fn == 'function') return fn;
  if (fn) {
    if (typeof fn[Symbol.asyncIterator] == 'function') return fn[Symbol.asyncIterator].bind(fn);
    if (typeof fn[Symbol.iterator] == 'function') return fn[Symbol.iterator].bind(fn);
  }
  throw new TypeError('The argument should be a function or an iterable object.');
};

export default dataSource;
export {dataSource};
