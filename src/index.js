// @ts-self-types="./index.d.ts"

import {Readable, Writable, Duplex} from 'node:stream';
import * as defs from './defs.js';
import gen from './gen.js';
import asStream from './asStream.js';
import asWebStream from './asWebStream.js';
import dataSource from './dataSource.js';

const {
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream,
  isReadableNodeStream,
  isWritableNodeStream,
  isDuplexNodeStream
} = defs;

// Carry a `batched()` marker across a Web→Node wrapper so chain's batching
// policy still sees a batch-capable downstream after Duplex/Writable.fromWeb.
const carryBatched = (src, dst) => (defs.isBatched(src) ? defs.batched(dst) : dst);

const groupFunctions = (output, fn, index, fns) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    output.push(fn);
    return output;
  }
  if (isDuplexWebStream(fn)) {
    output.push(carryBatched(fn, Duplex.fromWeb(fn, {objectMode: true})));
    return output;
  }
  if (!index && isReadableWebStream(fn)) {
    output.push(carryBatched(fn, Readable.fromWeb(fn, {objectMode: true})));
    return output;
  }
  if (index === fns.length - 1 && isWritableWebStream(fn)) {
    output.push(carryBatched(fn, Writable.fromWeb(fn, {objectMode: true})));
    return output;
  }
  if (typeof fn != 'function')
    throw TypeError('Item #' + index + ' is not a proper stream, nor a function.');
  if (!output.length) output.push([]);
  const last = output[output.length - 1];
  if (Array.isArray(last)) {
    last.push(fn);
  } else {
    output.push([fn]);
  }
  return output;
};

// Build a grouped item into a stream. A function group batches its drain when
// the next item consumes `many()` (a `batched()` stream — function groups are
// never adjacent, groupFunctions merges them) or, for the last group, when
// batchOutput is set. canBatch already folds in `batchSize > 1`.
const produceStreams = (item, next, canBatch, batchSize, batchOutput) => {
  if (!Array.isArray(item)) return item;
  if (!item.length) return null;
  const batchHere = canBatch && (next === undefined ? batchOutput : defs.isBatched(next));
  const options = batchHere ? {batch: batchSize} : undefined;
  if (item.length == 1) return item[0] && /** @type {any} */ (chain).asStream(item[0], options);
  return /** @type {any} */ (chain).asStream(/** @type {any} */ (chain).gen(...item), options);
};

const wrapFunctions = (fn, index, fns, options) => {
  if (
    isDuplexNodeStream(fn) ||
    (!index && isReadableNodeStream(fn)) ||
    (index === fns.length - 1 && isWritableNodeStream(fn))
  ) {
    return fn; // an acceptable stream
  }
  if (isDuplexWebStream(fn)) {
    return carryBatched(fn, Duplex.fromWeb(fn, {objectMode: true}));
  }
  if (!index && isReadableWebStream(fn)) {
    return carryBatched(fn, Readable.fromWeb(fn, {objectMode: true}));
  }
  if (index === fns.length - 1 && isWritableWebStream(fn)) {
    return carryBatched(fn, Writable.fromWeb(fn, {objectMode: true}));
  }
  if (typeof fn == 'function') return /** @type {any} */ (chain).asStream(fn, options); // a function
  throw TypeError('Item #' + index + ' is not a proper stream, nor a function.');
};

// default implementation of required stream methods

const write = (input, chunk, encoding, callback) => {
  let error = null;
  try {
    input.write(chunk, encoding, e => callback(e || error));
  } catch (e) {
    error = e;
  }
};

const final = (input, callback) => {
  let error = null;
  try {
    input.end(null, null, e => callback(e || error));
  } catch (e) {
    error = e;
  }
};

const read = output => {
  output.resume();
};

// the chain creator

const chain = (fns, options) => {
  if (!Array.isArray(fns) || !fns.length) {
    throw TypeError("Chain's first argument should be a non-empty array.");
  }

  fns = fns.flat(Infinity).filter(fn => fn);

  // Transport batching policy. `batch` defaults to 1000; `<= 1` disables it
  // (today's per-item behavior). batching only activates at a boundary whose
  // downstream consumes `many()` — internal `batched()` stages, or the chain's
  // own output when `batchOutput` is set. See produceStreams / the noGrouping map.
  const batchSize = options?.batch ?? 1000;
  const canBatch = batchSize > 1;
  const batchOutput = canBatch && !!options?.batchOutput;

  let rawStreams;
  if (options?.noGrouping) {
    // A function may batch into a following `batched()` stream (or the chain
    // output when batchOutput is set). Function-sections now unbundle a `many()`
    // input too (asStream's processInput), so batching section→section here
    // would be *safe* — we don't, to preserve noGrouping's per-stage
    // granularity and stay uniform with the grouping path (batch only into
    // `batched()`).
    rawStreams = fns.map((fn, index, arr) => {
      let opts;
      if (canBatch && typeof fn == 'function') {
        const next = arr[index + 1];
        const batchHere = next === undefined ? batchOutput : defs.isBatched(next);
        if (batchHere) opts = {batch: batchSize};
      }
      return wrapFunctions(fn, index, arr, opts);
    });
  } else {
    const grouped = fns
      .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
      .flat(Infinity)
      .reduce(groupFunctions, []);
    rawStreams = grouped.map((item, i) =>
      produceStreams(item, grouped[i + 1], canBatch, batchSize, batchOutput)
    );
  }

  const streams = rawStreams.filter(s => s),
    input = streams[0],
    output = streams.reduce((output, item) => (output && output.pipe(item)) || item);

  let stream = null; // will be assigned later

  let writeMethod = (chunk, encoding, callback) => write(input, chunk, encoding, callback),
    finalMethod = callback => final(input, callback),
    readMethod = () => read(output);

  if (!isWritableNodeStream(input)) {
    writeMethod = (_1, _2, callback) => callback(null);
    finalMethod = callback => callback(null);
    input.on('end', () => stream.end());
  }

  if (isReadableNodeStream(output)) {
    output.on('data', chunk => !stream.push(chunk) && output.pause());
    output.on('end', () => stream.push(null));
  } else {
    readMethod = () => {}; // nop
    output.on('finish', () => stream.push(null));
  }

  stream = /** @type {Duplex & {streams: any[], input: any, output: any}} */ (
    new Duplex({
      writableObjectMode: true,
      readableObjectMode: true,
      ...options,
      readable: isReadableNodeStream(output),
      writable: isWritableNodeStream(input),
      write: writeMethod,
      final: finalMethod,
      read: readMethod
    })
  );
  stream.streams = streams;
  stream.input = input;
  stream.output = output;

  if (!isReadableNodeStream(output)) {
    stream.resume();
  }

  // connect events
  if (!options?.skipEvents) {
    streams.forEach(item => item.on('error', error => stream.emit('error', error)));
  }

  return stream;
};

// from defs.js
chain.none = defs.none;
chain.stop = defs.stop;
chain.Stop = defs.Stop;

chain.finalSymbol = defs.finalSymbol;
chain.finalValue = defs.finalValue;
chain.final = defs.final;
chain.isFinalValue = defs.isFinalValue;
chain.getFinalValue = defs.getFinalValue;

chain.manySymbol = defs.manySymbol;
chain.many = defs.many;
chain.isMany = defs.isMany;
chain.getManyValues = defs.getManyValues;

chain.flushSymbol = defs.flushSymbol;
chain.flushable = defs.flushable;
chain.isFlushable = defs.isFlushable;

chain.fListSymbol = defs.fListSymbol;
chain.isFunctionList = defs.isFunctionList;
chain.getFunctionList = defs.getFunctionList;
chain.setFunctionList = defs.setFunctionList;
chain.clearFunctionList = defs.clearFunctionList;

chain.batchedSymbol = defs.batchedSymbol;
chain.batched = defs.batched;
chain.isBatched = defs.isBatched;

chain.toMany = defs.toMany;
chain.normalizeMany = defs.normalizeMany;
chain.combineMany = defs.combineMany;
chain.combineManyMut = defs.combineManyMut;

chain.chain = chain; // for compatibility with 2.x
chain.chainUnchecked = chain; // for TypeScript to bypass type checks
chain.gen = gen;
chain.asStream = asStream;
chain.asWebStream = asWebStream;

chain.dataSource = dataSource;

export default chain;
export {chain, chain as chainUnchecked, gen, asStream, asWebStream, dataSource};
export * from './defs.js';
