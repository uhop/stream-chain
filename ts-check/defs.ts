import {
  isFinalValue,
  finalValue,
  getFinalValue,

  isMany,
  many,
  getManyValues,

  isFlushable,
  flushable,

  isFunctionList,
  getFunctionList,
  setFunctionList,
  clearFunctionList
} from 'stream-chain/defs.js';

{
  const x = finalValue(42);
  if (isFinalValue(x)) {
    const t = getFinalValue(x);
    void t;
  }
  const z = getFinalValue(x);
  void z;

  const w = {};
  if (isFinalValue(w)) {
    const t = getFinalValue(w);
    void t;
  }
  // const v = getFinalValue(w);
  // void v;
}

{
  const x = many([1, 2, 3]);
  if (isMany(x)) {
    const t = getManyValues(x);
    void t;
  }
  const z = getManyValues(x);
  void z;

  const w = {};
  if (isMany(w)) {
    const t = getManyValues(w);
    void t;
  }
  // const v = getManyValues(w);
  // void v;
}

{
  const x = flushable((x: number) => x * x);
  if (isFlushable(x)) {
    const t = x(42);
    void t;
  }
  const z = x(42);
  void z;

  const w = (x: string) => x + 'x';
  if (isFlushable(w)) {
    const t = w('42');
    void t;
  }
}

{
  const x = setFunctionList((x: number) => x * x, [() => 42]);
  if (isFunctionList(x)) {
    const t = getFunctionList(x);
    void t;
  }
  const z = getFunctionList(x);
  void z;

  const y = (x: string) => x + 'x';
  if (isFunctionList(y)) {
    const t = getFunctionList(y);
    void t;
  }

  const w = clearFunctionList(x);
  if (isFunctionList(w)) {
    const t = getFunctionList(w);
    void t;
  }

  // const v = getFunctionList(w);
  // void v;

  void w;
}
