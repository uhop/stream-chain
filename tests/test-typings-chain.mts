import test from 'tape-six';

import chain, {chainUnchecked, many, none, stop, finalValue, asStream, gen} from '../src/index.js';
import {TypedTransform} from '../src/typed-streams.js';
import readableFrom from '../src/utils/readableFrom.js';

import {Transform} from 'node:stream';

test.asPromise('typings chain: typed function chain', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    (x: number) => 2 * x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});

test.asPromise('typings chain: many and none', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => many([x, x * x]),
    (x: number) => (x % 2 ? x : none)
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 3, 9]);
    resolve();
  });
});

test.asPromise('typings chain: async function', (t, resolve) => {
  const output: string[] = [];
  const c = chain([readableFrom([1, 2, 3]), async (x: number) => String(x * x)] as const);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings chain: generator function', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    function* (x: number) {
      yield x;
      yield x * x;
    }
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 1, 2, 4, 3, 9]);
    resolve();
  });
});

test.asPromise('typings chain: TypedTransform in chain', (t, resolve) => {
  const output: string[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    new TypedTransform<number, string>({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, String(x));
      }
    })
  ] as const);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, ['1', '4', '9']);
    resolve();
  });
});

test.asPromise('typings chain: untyped Transform in chain', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    new Transform({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, x * x);
      }
    })
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings chain: asStream wraps a function', (t, resolve) => {
  const output: boolean[] = [];
  const c = chain([readableFrom([1, 2, 3]), asStream((x: number) => x > 1)] as const);

  c.on('data', (data: boolean) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [false, true, true]);
    resolve();
  });
});

test.asPromise('typings chain: chainUnchecked', (t, resolve) => {
  const output: number[] = [];
  const c = chainUnchecked<number, number>([(x: number) => x * x, (x: number) => x + 1], {
    writableObjectMode: true,
    readableObjectMode: true
  });

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});

test.asPromise('typings chain: options', (t, resolve) => {
  const output: number[] = [];
  const c = chain([(x: number) => x * x] as const, {noGrouping: true});

  t.ok(c.streams.length > 0);
  t.ok(c.input);
  t.ok(c.output);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});

test.asPromise('typings chain: null and undefined passthrough', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => x * x,
    null,
    undefined,
    (x: number) => x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 5, 10]);
    resolve();
  });
});

test.asPromise('typings chain: finalValue', (t, resolve) => {
  const output: number[] = [];
  const c = chain([
    readableFrom([1, 2, 3]),
    (x: number) => finalValue(x * x),
    (x: number) => x + 1
  ] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 4, 9]);
    resolve();
  });
});

test.asPromise('typings chain: stop', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), (x: number) => (x > 2 ? stop : x)] as const);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2]);
    resolve();
  });
});

test.asPromise('typings chain: gen in chain', (t, resolve) => {
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
