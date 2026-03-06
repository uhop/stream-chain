'use strict';

const {test} = require('tape-six');

const chain = require('../src/index.js');
const readableFrom = require('../src/utils/readableFrom.js');

test.asPromise('cjs: require chain', (t, resolve) => {
  const output = [];
  const c = chain([readableFrom([1, 2, 3]), x => x * x, x => 2 * x + 1]);

  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('cjs: require defs', (t, resolve) => {
  const {many, none, getManyValues, finalValue, isFinalValue, getFinalValue} = chain;

  t.equal(typeof none, 'symbol');
  t.deepEqual(getManyValues(many([1, 2, 3])), [1, 2, 3]);

  const fv = finalValue(42);
  t.ok(isFinalValue(fv));
  t.equal(getFinalValue(fv), 42);

  const output = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    x => chain.many([x, x * x]),
    x => (x % 2 ? x : chain.none)
  ]);

  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 3, 9]);
    resolve();
  });
});

test.asPromise('cjs: require utilities', (t, resolve) => {
  const skip = require('../src/utils/skip.js');
  const take = require('../src/utils/take.js');
  const batch = require('../src/utils/batch.js');

  const output = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), skip(2), take(5), batch(3)]);

  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [
      [3, 4, 5],
      [6, 7]
    ]);
    resolve();
  });
});

test.asPromise('cjs: require gen and fun', (t, resolve) => {
  const gen = require('../src/gen.js');
  const fun = require('../src/fun.js');

  const output = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      x => x * x,
      x => 2 * x + 1
    )
  ]);

  c.on('data', data => output.push(data));
  c.on('end', async () => {
    t.deepEqual(output, [3, 9, 19]);

    const fn = fun(
      x => x * x,
      x => x + 1
    );
    const result = await fn(3);
    t.deepEqual(result.values, [10]);

    resolve();
  });
});

test.asPromise('cjs: require jsonl', (t, resolve) => {
  const parserStream = require('../src/jsonl/parserStream.js');
  const stringerStream = require('../src/jsonl/stringerStream.js');

  const output = [];
  const c = chain([readableFrom([{a: 1}, {b: 2}]), stringerStream({separator: '\n'})]);

  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.equal(output.join(''), '{"a":1}\n{"b":2}');
    resolve();
  });

  void parserStream;
});
