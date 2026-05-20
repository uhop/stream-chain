// @ts-self-types="./index.d.ts"

import * as defs from '../defs.js';
import gen from '../gen.js';
import fun from '../fun.js';
import asWebStream, {
  isReadableWebStream,
  isWritableWebStream,
  isDuplexWebStream
} from './asWebStream.js';

// Normalize a chain item into a {readable, writable} stage.
// readable may be null for terminal sinks; writable may be null for sources.
const normalizeStage = (item, i, total) => {
  if (isDuplexWebStream(item)) return item;
  if (i === 0 && isReadableWebStream(item)) {
    return {readable: item, writable: null};
  }
  if (i === total - 1 && isWritableWebStream(item)) {
    return {readable: null, writable: item};
  }
  if (typeof item === 'function') return asWebStream(item);
  throw new TypeError(
    `Item #${i} is not a Web Streams object, function, or asWebStream-wrapped item.`
  );
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

  const stages = fns.map((item, i) => normalizeStage(item, i, fns.length));

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
    // Swallow rejection — Web Streams already propagates errors to both ends via pipeTo;
    // the unhandled rejection would just be noise.
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
export {isReadableWebStream, isWritableWebStream, isDuplexWebStream} from './asWebStream.js';
export * from '../defs.js';
