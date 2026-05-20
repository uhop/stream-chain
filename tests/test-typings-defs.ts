import test from 'tape-six';

import {
  none,
  stop,
  finalValue,
  isFinalValue,
  getFinalValue,
  many,
  isMany,
  getManyValues,
  flushable,
  isFlushable,
  setFunctionList,
  isFunctionList,
  getFunctionList,
  clearFunctionList,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut
} from '../src/defs.js';

test('typings defs: finalValue type guard', t => {
  const fv = finalValue(42);
  t.ok(isFinalValue(fv));
  t.equal(getFinalValue(fv), 42);

  const obj: object = {notFinal: true};
  if (isFinalValue(obj)) {
    void getFinalValue(obj);
    t.fail('should not be a final value');
  } else {
    t.ok(true);
  }
});

test('typings defs: many type guard', t => {
  const m = many([1, 2, 3]);
  t.ok(isMany(m));
  t.deepEqual(getManyValues(m), [1, 2, 3]);

  const obj: unknown = {notMany: true};
  if (isMany(obj)) {
    void getManyValues(obj);
    t.fail('should not be many');
  } else {
    t.ok(true);
  }
});

test('typings defs: flushable type guard', t => {
  const fn = flushable((x: number) => x * x);
  t.ok(isFlushable(fn));
  t.equal(fn(3), 9);

  const plain = (x: number) => x + 1;
  t.notOk(isFlushable(plain));
});

test('typings defs: functionList type guard', t => {
  const fn = setFunctionList((x: number) => x * x, [() => 42]);
  t.ok(isFunctionList(fn));

  const fns = getFunctionList(fn);
  t.ok(Array.isArray(fns));

  const cleared = clearFunctionList(fn);
  t.notOk(isFunctionList(cleared));
});

test('typings defs: toMany', t => {
  t.deepEqual(getManyValues(toMany(none)), []);
  t.deepEqual(getManyValues(toMany(1)), [1]);
  t.deepEqual(getManyValues(toMany(many([1, 2, 3]))), [1, 2, 3]);
});

test('typings defs: normalizeMany', t => {
  t.equal(normalizeMany(many([])), none);
  t.equal(normalizeMany(many([1])), 1);

  const result = normalizeMany(many([1, 2, 3]));
  if (isMany(result)) {
    t.deepEqual(getManyValues(result), [1, 2, 3]);
  } else {
    t.fail('expected Many');
  }
});

test('typings defs: combineMany', t => {
  t.deepEqual(getManyValues(combineMany(none, none)), []);
  t.deepEqual(getManyValues(combineMany(none, 2)), [2]);
  t.deepEqual(getManyValues(combineMany(1, none)), [1]);
  t.deepEqual(getManyValues(combineMany(1, 2)), [1, 2]);
  t.deepEqual(getManyValues(combineMany(many([1, 2]), many([3, 4]))), [1, 2, 3, 4]);
  t.deepEqual(getManyValues(combineMany(0, many([1, 2, 3]))), [0, 1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(many([1, 2, 3]), 4)), [1, 2, 3, 4]);
});

test('typings defs: combineMany variadic', t => {
  t.deepEqual(getManyValues(combineMany()), []);
  t.deepEqual(getManyValues(combineMany(1, 2, 3)), [1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(none, 1, none, 2, none)), [1, 2]);
  t.deepEqual(getManyValues(combineMany(many([1]), 2, many([3, 4]))), [1, 2, 3, 4]);
  t.deepEqual(getManyValues(combineMany(1, none, many([2, 3]), 4, many([5]))), [1, 2, 3, 4, 5]);
});

test('typings defs: combineMany immutability', t => {
  const a = many([1, 2, 3]);
  const b = many([4, 5, 6]);
  const c = combineMany(a, b);
  t.deepEqual(getManyValues(a), [1, 2, 3]);
  t.deepEqual(getManyValues(b), [4, 5, 6]);
  t.deepEqual(getManyValues(c), [1, 2, 3, 4, 5, 6]);
});

test('typings defs: combineManyMut', t => {
  t.deepEqual(getManyValues(combineManyMut(none, none)), []);
  t.deepEqual(getManyValues(combineManyMut(none, 2)), [2]);
  t.deepEqual(getManyValues(combineManyMut(1, none)), [1]);
  t.deepEqual(getManyValues(combineManyMut(1, 2)), [1, 2]);
  t.deepEqual(getManyValues(combineManyMut(many([1, 2]), many([3, 4]))), [1, 2, 3, 4]);
});

test('typings defs: combineManyMut variadic', t => {
  t.deepEqual(getManyValues(combineManyMut(none)), []);
  t.deepEqual(getManyValues(combineManyMut(1, 2, 3)), [1, 2, 3]);
  t.deepEqual(getManyValues(combineManyMut(none, 1, none, 2, none)), [1, 2]);
  t.deepEqual(getManyValues(combineManyMut(many([1]), 2, many([3, 4]))), [1, 2, 3, 4]);
});

test('typings defs: combineManyMut mutability', t => {
  const a = many([1, 2, 3]);
  const b = many([4, 5, 6]);
  const c = combineManyMut(a, b);
  t.deepEqual(getManyValues(a), [1, 2, 3, 4, 5, 6]);
  t.deepEqual(getManyValues(b), [4, 5, 6]);
  t.deepEqual(getManyValues(c), [1, 2, 3, 4, 5, 6]);
});

test('typings defs: none and stop are distinct', t => {
  t.notEqual(none, stop);
  t.equal(typeof none, 'symbol');
  t.equal(typeof stop, 'symbol');
});
