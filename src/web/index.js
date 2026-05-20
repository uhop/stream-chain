// @ts-self-types="./index.d.ts"

import * as defs from '../defs.js';
import gen from '../gen.js';
import fun from '../fun.js';
import asWebStream, {
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream
} from '../asWebStream.js';

// Group consecutive functions into arrays (mirrors /node's groupFunctions) so the
// produceStages step can bundle each group into a single asWebStream(gen(...group))
// call — taking asWebStream's fast path (applyFns) instead of one TransformStream
// per function.
const groupFunctions = (output, item, index, items) => {
  if (isDuplexWebStream(item)) {
    output.push(item);
    return output;
  }
  if (!index && isReadableWebStream(item)) {
    output.push({readable: item, writable: null});
    return output;
  }
  if (index === items.length - 1 && isWritableWebStream(item)) {
    output.push({readable: null, writable: item});
    return output;
  }
  if (typeof item !== 'function') {
    throw new TypeError(`Item #${index} is not a Web Streams object or function.`);
  }
  if (!output.length) output.push([]);
  const last = output[output.length - 1];
  if (Array.isArray(last)) {
    last.push(item);
  } else {
    output.push([item]);
  }
  return output;
};

const produceStages = item => {
  if (Array.isArray(item)) {
    if (!item.length) return null;
    if (item.length === 1) return /** @type {any} */ (chain).asWebStream(item[0]);
    return /** @type {any} */ (chain).asWebStream(/** @type {any} */ (chain).gen(...item));
  }
  return item;
};

const chain = (fns, _options) => {
  if (!Array.isArray(fns) || !fns.length) {
    throw new TypeError("Chain's first argument should be a non-empty array.");
  }

  fns = fns
    .flat(Infinity)
    .filter(Boolean)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);

  if (!fns.length) {
    throw new TypeError("Chain's first argument is empty after flattening.");
  }

  const stages = fns.reduce(groupFunctions, []).map(produceStages).filter(s => s);

  // Pipe stages together. pipeTo handles backpressure + error propagation.
  for (let i = 0; i < stages.length - 1; ++i) {
    const from = stages[i].readable;
    const to = stages[i + 1].writable;
    if (!from) {
      throw new TypeError(`Stage #${i} has no readable side; cannot pipe to next stage.`);
    }
    if (!to) {
      throw new TypeError(`Stage #${i + 1} has no writable side; cannot accept input.`);
    }
    from.pipeTo(to).catch(() => {});
  }

  const c = {
    readable: stages[stages.length - 1].readable,
    writable: stages[0].writable,
    streams: stages,
    input: stages[0],
    output: stages[stages.length - 1]
  };

  return c;
};

// Override-hook + ChainOutput parity statics (mirrors /node and /core).
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

chain.toMany = defs.toMany;
chain.normalizeMany = defs.normalizeMany;
chain.combineMany = defs.combineMany;
chain.combineManyMut = defs.combineManyMut;

chain.chain = chain;
chain.chainUnchecked = chain;
chain.gen = gen;
chain.fun = fun;
chain.asWebStream = asWebStream;

export default chain;
export {chain, chain as chainUnchecked, gen, fun, asWebStream};
export {isReadableWebStream, isWritableWebStream, isDuplexWebStream} from '../asWebStream.js';
export * from '../defs.js';
