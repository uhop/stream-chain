import {
  none,
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
  clearFunctionList,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut
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

{
  const x1 = toMany(none),
    t1 = getManyValues(x1);
  console.assert(t1.length === 0);

  const x2 = toMany(1),
    t2 = getManyValues(x2);
  console.assert(t2.length === 1);

  const x3 = toMany(many([1, 2, 3])),
    t3 = getManyValues(x3);
  console.assert(t3.length === 3);
}

{
  const x1 = normalizeMany(many([]));
  console.assert(x1 === none);

  const x2 = normalizeMany(many([1]));
  console.assert(x2 === 1);

  const x3 = normalizeMany(many([1, 2, 3]));
  if (isMany(x3)) {
    console.assert(getManyValues(x3).length === 3);
  }
  console.assert(isMany(x3));
}

{
  const x1 = combineMany(none, none);
  console.assert(getManyValues(x1).length === 0);

  const x2 = combineMany(none, many([1, 2, 3]));
  console.assert(getManyValues(x2).length === 3);

  const x3 = combineMany(many([1, 2, 3]), none);
  console.assert(getManyValues(x3).length === 3);

  const x4 = combineMany(many([1, 2, 3]), many([4, 5, 6]));
  console.assert(getManyValues(x4).length === 6);

  const x5 = combineMany(0, many([1, 2, 3]));
  console.assert(getManyValues(x5).length === 4);

  const x6 = combineMany(many([1, 2, 3]), 4);
  console.assert(getManyValues(x6).length === 4);

  const x7 = combineMany(1, 2);
  console.assert(getManyValues(x7).length === 2);
}

{
  const x1 = combineManyMut(none, none);
  console.assert(getManyValues(x1).length === 0);

  const x2 = combineManyMut(none, many([1, 2, 3]));
  console.assert(getManyValues(x2).length === 3);

  const x3 = combineManyMut(many([1, 2, 3]), none);
  console.assert(getManyValues(x3).length === 3);

  const x4 = combineManyMut(many([1, 2, 3]), many([4, 5, 6]));
  console.assert(getManyValues(x4).length === 6);

  const x5 = combineManyMut(0, many([1, 2, 3]));
  console.assert(getManyValues(x5).length === 4);

  const x6 = combineManyMut(many([1, 2, 3]), 4);
  console.assert(getManyValues(x6).length === 4);

  const x7 = combineManyMut(1, 2);
  console.assert(getManyValues(x7).length === 2);
}
