// @ts-self-types="./index.d.ts"

import * as defs from '../defs.js';
import gen from '../gen.js';
import fun from '../fun.js';

const chain = (fns, _options) => {
  const flat = (Array.isArray(fns) ? fns : [])
    .flat(Infinity)
    .filter(Boolean)
    .map(fn => (defs.isFunctionList(fn) ? defs.getFunctionList(fn) : fn))
    .flat(Infinity);
  const g = gen(...flat);
  const c = async function* (input) {
    if (input == null) return;
    for await (const value of input) yield* g(value);
  };
  c.streams = null;
  c.input = null;
  c.output = null;
  return c;
};

// Override-hook + ChainOutput parity statics (mirrors the /node entry)
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

export default chain;
export {chain, chain as chainUnchecked, gen, fun};
export * from '../defs.js';
