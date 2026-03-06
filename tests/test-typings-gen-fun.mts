import test from 'tape-six';

import chain, {gen, none, finalValue} from '../src/index.js';
import fun from '../src/fun.js';
import readableFrom from '../src/utils/readableFrom.js';

test.asPromise('typings gen: typed pipeline', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      (x: number) => 2 * x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('typings gen: async function in pipeline', (t, resolve) => {
  const output: string[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      async (x: number) => x * x,
      (x: number) => String(x)
    )
  ]);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings gen: generator function in pipeline', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(function* (x: number) {
      yield x;
      yield x * x;
    })
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 3, 9]);
    resolve();
  });
});

test.asPromise('typings gen: none filters values', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3, 4, 5]),
    gen(
      (x: number) => x * x,
      (x: number) => (x > 5 ? x : none)
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [9, 16, 25]);
    resolve();
  });
});

test.asPromise('typings gen: finalValue skips rest', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      (x: number) => finalValue(x),
      (x: number) => 2 * x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings gen: null passthrough', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    gen(
      (x: number) => x * x,
      null,
      (x: number) => x + 1
    )
  ]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });
});

test.asPromise('typings gen: identity', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), gen()]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('typings fun: typed pipeline', async (t, resolve) => {
  const fn = fun(
    (x: number) => x * x,
    (x: number) => 2 * x + 1
  );

  const result = await fn(3);
  t.deepEqual(result.values, [19]);
  resolve();
});

test.asPromise('typings fun: async pipeline', async (t, resolve) => {
  const fn = fun(
    async (x: number) => x * x,
    (x: number) => String(x)
  );

  const result = await fn(3);
  t.deepEqual(result.values, ['9']);
  resolve();
});

test.asPromise('typings fun: identity', async (t, resolve) => {
  const fn = fun();
  const result = await fn(42);
  t.deepEqual(result.values, [42]);
  resolve();
});
