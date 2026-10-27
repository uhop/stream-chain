'use strict';

import test from 'tape-six';

import {
  getManyValues,
  many,
  none,
  stop,
  Stop,
  isStop,
  toMany,
  normalizeMany,
  combineMany,
  combineManyMut
} from '../../src/defs.js';

// A library compatible with stream-chain defines its own Stop class with the well-known mark.
class ForeignStop extends Error {}
ForeignStop.prototype[Symbol.for('object-stream.stopError')] = 1;

test('defs: isStop()', t => {
  t.ok(isStop(new Stop()), 'a Stop');
  t.ok(isStop(new (class extends Stop {})()), 'a subclass of Stop');
  t.ok(isStop(new ForeignStop()), "a compatible library's Stop");
  t.notOk(isStop(new Error('boom')), 'an Error');
  t.notOk(isStop(stop), 'the stop value, which is returned, not thrown');
  t.notOk(isStop(null), 'null');
  t.notOk(isStop(undefined), 'undefined');
  t.notOk(isStop({}), 'a plain object');
});

test('defs: toMany()', t => {
  t.deepEqual(getManyValues(toMany(none)), []);
  t.deepEqual(getManyValues(toMany(1)), [1]);
  t.deepEqual(getManyValues(toMany(many([]))), []);
  t.deepEqual(getManyValues(toMany(many([1, 2, 3]))), [1, 2, 3]);
});

test('defs: normalizeMany()', t => {
  t.deepEqual(normalizeMany(none), none);
  t.deepEqual(normalizeMany(1), 1);
  t.deepEqual(normalizeMany(many([])), none);
  t.deepEqual(normalizeMany(many([1])), 1);
  t.deepEqual(getManyValues(normalizeMany(many([1, 2, 3]))), [1, 2, 3]);
});

test('defs: combineMany()', t => {
  t.deepEqual(getManyValues(combineMany(none, none)), []);
  t.deepEqual(getManyValues(combineMany(none, 2)), [2]);
  t.deepEqual(getManyValues(combineMany(1, none)), [1]);
  t.deepEqual(getManyValues(combineMany(none, many([]))), []);
  t.deepEqual(getManyValues(combineMany(1, many([]))), [1]);
  t.deepEqual(getManyValues(combineMany(none, many([1, 2, 3]))), [1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(0, many([1, 2, 3]))), [0, 1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(many([]), none)), []);
  t.deepEqual(getManyValues(combineMany(many([]), 1)), [1]);
  t.deepEqual(getManyValues(combineMany(many([1]), 2)), [1, 2]);
  t.deepEqual(getManyValues(combineMany(many([1, 2, 3]), many([]))), [1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(many([1, 2, 3]), many([4, 5, 6]))), [1, 2, 3, 4, 5, 6]);
});

test('defs: combineMany() - variadic', t => {
  t.deepEqual(getManyValues(combineMany()), []);
  t.deepEqual(getManyValues(combineMany(none)), []);
  t.deepEqual(getManyValues(combineMany(1)), [1]);
  t.deepEqual(getManyValues(combineMany(many([1, 2]))), [1, 2]);
  t.deepEqual(getManyValues(combineMany(1, 2, 3)), [1, 2, 3]);
  t.deepEqual(getManyValues(combineMany(none, 1, none, 2, none)), [1, 2]);
  t.deepEqual(getManyValues(combineMany(many([1]), 2, many([3, 4]))), [1, 2, 3, 4]);
  t.deepEqual(getManyValues(combineMany(1, none, many([2, 3]), 4, many([5]))), [1, 2, 3, 4, 5]);
});

test('defs: combineMany() - immutability', t => {
  const a = many([1, 2, 3]),
    b = many([4, 5, 6]),
    c = combineMany(a, b);
  t.deepEqual(getManyValues(a), [1, 2, 3]);
  t.deepEqual(getManyValues(b), [4, 5, 6]);
  t.deepEqual(getManyValues(c), [1, 2, 3, 4, 5, 6]);
});

test('defs: combineManyMut()', t => {
  t.deepEqual(getManyValues(combineManyMut(none, none)), []);
  t.deepEqual(getManyValues(combineManyMut(none, 2)), [2]);
  t.deepEqual(getManyValues(combineManyMut(1, none)), [1]);
  t.deepEqual(getManyValues(combineManyMut(none, many([]))), []);
  t.deepEqual(getManyValues(combineManyMut(1, many([]))), [1]);
  t.deepEqual(getManyValues(combineManyMut(none, many([1, 2, 3]))), [1, 2, 3]);
  t.deepEqual(getManyValues(combineManyMut(0, many([1, 2, 3]))), [0, 1, 2, 3]);
  t.deepEqual(getManyValues(combineManyMut(many([]), none)), []);
  t.deepEqual(getManyValues(combineManyMut(many([]), 1)), [1]);
  t.deepEqual(getManyValues(combineManyMut(many([1]), 2)), [1, 2]);
  t.deepEqual(getManyValues(combineManyMut(many([1, 2, 3]), many([]))), [1, 2, 3]);
  t.deepEqual(getManyValues(combineManyMut(many([1, 2, 3]), many([4, 5, 6]))), [1, 2, 3, 4, 5, 6]);
});

test('defs: combineManyMut() - variadic', t => {
  t.deepEqual(getManyValues(combineManyMut(none)), []);
  t.deepEqual(getManyValues(combineManyMut(1)), [1]);
  t.deepEqual(getManyValues(combineManyMut(many([1, 2]))), [1, 2]);
  t.deepEqual(getManyValues(combineManyMut(1, 2, 3)), [1, 2, 3]);
  t.deepEqual(getManyValues(combineManyMut(none, 1, none, 2, none)), [1, 2]);
  t.deepEqual(getManyValues(combineManyMut(many([1]), 2, many([3, 4]))), [1, 2, 3, 4]);
});

test('defs: combineManyMut() - variadic mutability', t => {
  const a = many([1]),
    b = many([3, 4]);
  combineManyMut(a, 2, b);
  t.deepEqual(getManyValues(a), [1, 2, 3, 4]);
  t.deepEqual(getManyValues(b), [3, 4]);
});

test('defs: combineManyMut() - variadic only first mutated', t => {
  const a = many([10]),
    b = many([20]),
    c = many([30]);
  combineManyMut(none, a, b, c);
  t.deepEqual(getManyValues(a), [10]);
  t.deepEqual(getManyValues(b), [20]);
  t.deepEqual(getManyValues(c), [30]);
});

test('defs: combineManyMut() - mutability', t => {
  const a = many([1, 2, 3]),
    b = many([4, 5, 6]),
    c = combineManyMut(a, b);
  t.deepEqual(getManyValues(a), [1, 2, 3, 4, 5, 6]);
  t.deepEqual(getManyValues(b), [4, 5, 6]);
  t.deepEqual(getManyValues(c), [1, 2, 3, 4, 5, 6]);
});
