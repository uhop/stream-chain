// @ts-self-types="./defs.d.ts"

const none = Symbol.for('object-stream.none');
const stop = Symbol.for('object-stream.stop');

const finalSymbol = Symbol.for('object-stream.final');
const manySymbol = Symbol.for('object-stream.many');
const flushSymbol = Symbol.for('object-stream.flush');
const fListSymbol = Symbol.for('object-stream.fList');
const batchedSymbol = Symbol.for('object-stream.batched');

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

// `batched` marks a stream/sink as batch-capable: it consumes `many()`
// envelopes as single chunks and unbundles them itself. It's a pure capability
// flag — the batch *size* is chain()'s `{batch:N}` option, not stored here, and
// the size of an actual batch in flight is the `many()` envelope's array
// length. chain() reads the marker to decide whether to batch a section's drain
// into the marked downstream stage.
const batched = target => {
  target[batchedSymbol] = 1;
  return target;
};

const isBatched = o => o && o[batchedSymbol] === 1;

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
// Stream type guards (shape-based). Live in defs.js so the symmetric
// is*WebStream and is*NodeStream are co-located and reachable from any
// subpath. Neither path imports `node:stream` — both are duck-typed:
//
// - Web: ReadableStream has `getReader`, WritableStream has `getWriter`
//   (Node streams expose neither).
// - Node: streams expose `.pipe` / `.write` / `.on` plus the private
//   `_readableState` / `_writableState` markers (Web streams expose none).
//
// Node guard logic is taken from
// https://github.com/nodejs/node/blob/master/lib/internal/streams/utils.js
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

const isReadableNodeStream = obj =>
  obj &&
  typeof obj.pipe === 'function' &&
  typeof obj.on === 'function' &&
  (!obj._writableState ||
    (typeof obj._readableState === 'object' ? obj._readableState.readable : null) !== false) &&
  (!obj._writableState || obj._readableState);

const isWritableNodeStream = obj =>
  obj &&
  typeof obj.write === 'function' &&
  typeof obj.on === 'function' &&
  (!obj._readableState ||
    (typeof obj._writableState === 'object' ? obj._writableState.writable : null) !== false);

const isDuplexNodeStream = obj =>
  obj &&
  typeof obj.pipe === 'function' &&
  obj._readableState &&
  typeof obj.on === 'function' &&
  typeof obj.write === 'function';

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
  batchedSymbol,
  batched,
  isBatched,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut,
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream,
  isReadableNodeStream,
  isWritableNodeStream,
  isDuplexNodeStream
};
