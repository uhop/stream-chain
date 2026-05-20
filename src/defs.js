// @ts-self-types="./defs.d.ts"

const none = Symbol.for('object-stream.none');
const stop = Symbol.for('object-stream.stop');

const finalSymbol = Symbol.for('object-stream.final');
const manySymbol = Symbol.for('object-stream.many');
const flushSymbol = Symbol.for('object-stream.flush');
const fListSymbol = Symbol.for('object-stream.fList');

const finalValue = value => ({[finalSymbol]: 1, value});
const many = values => ({[manySymbol]: 1, values});

const isFinalValue = o => o && o[finalSymbol] === 1;
const isMany = o => o && o[manySymbol] === 1;
const isFlushable = o => o && o[flushSymbol] === 1;
const isFunctionList = o => o && o[fListSymbol] === 1;

const getFinalValue = o => o.value;
const getManyValues = o => o.values;
const getFunctionList = o => o.fList;

const flushable = (write, final = null) => {
  const fn = final ? value => (value === none ? final() : write(value)) : write;
  fn[flushSymbol] = 1;
  return fn;
};

const setFunctionList = (o, fns) => {
  o.fList = fns;
  o[fListSymbol] = 1;
  return o;
};

const clearFunctionList = o => {
  delete o.fList;
  delete o[fListSymbol];
  return o;
};

class Stop extends Error {}

const toMany = value =>
  value === none ? many([]) : value && value[manySymbol] === 1 ? value : many([value]);

const normalizeMany = o => {
  if (o?.[manySymbol] === 1) {
    switch (o.values.length) {
      case 0:
        return none;
      case 1:
        return o.values[0];
    }
  }
  return o;
};

const combineMany = (...args) => {
  const values = [];
  for (let i = 0; i < args.length; ++i) {
    const a = args[i];
    if (a === none) continue;
    if (a?.[manySymbol] === 1) {
      values.push(...a.values);
    } else {
      values.push(a);
    }
  }
  return many(values);
};

const combineManyMut = (a, ...args) => {
  const values = a === none ? [] : a?.[manySymbol] === 1 ? a.values : [a];
  for (let i = 0; i < args.length; ++i) {
    const b = args[i];
    if (b === none) continue;
    if (b?.[manySymbol] === 1) {
      values.push(...b.values);
    } else {
      values.push(b);
    }
  }
  return many(values);
};

// ---------------------------------------------------------------------------
// Web Streams type guards. Shape-based: a Web ReadableStream has `getReader`
// (Node Readable does not), a WritableStream has `getWriter` (Node Writable
// does not), so a method-presence test suffices to disambiguate the two
// substrates without needing a separate "not a Node stream" check.
// ---------------------------------------------------------------------------

const isReadableWebStream = x =>
  !!(
    x &&
    typeof x === 'object' &&
    typeof x.getReader === 'function' &&
    typeof x.pipeTo === 'function'
  );

const isWritableWebStream = x =>
  !!(
    x &&
    typeof x === 'object' &&
    typeof x.getWriter === 'function' &&
    typeof x.abort === 'function'
  );

const isDuplexWebStream = x =>
  !!(
    x &&
    typeof x === 'object' &&
    isReadableWebStream(x.readable) &&
    isWritableWebStream(x.writable)
  );

// old aliases
const final = finalValue;

export {
  none,
  stop,
  Stop,
  finalSymbol,
  finalValue,
  final,
  isFinalValue,
  getFinalValue,
  manySymbol,
  many,
  isMany,
  getManyValues,
  flushSymbol,
  flushable,
  isFlushable,
  fListSymbol,
  isFunctionList,
  getFunctionList,
  setFunctionList,
  clearFunctionList,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut,
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream
};
