import test from 'tape-six';

import chain from '../src/index.js';
import readableFrom from '../src/utils/readableFrom.js';
import skip from '../src/utils/skip.js';
import skipWhile from '../src/utils/skipWhile.js';
import take from '../src/utils/take.js';
import takeWhile from '../src/utils/takeWhile.js';
import takeWithSkip from '../src/utils/takeWithSkip.js';
import fold from '../src/utils/fold.js';
import scan from '../src/utils/scan.js';
import batch from '../src/utils/batch.js';
import reduceStream from '../src/utils/reduceStream.js';
import parser from '../src/jsonl/parser.js';
import parserStream from '../src/jsonl/parserStream.js';
import stringerStream from '../src/jsonl/stringerStream.js';

test.asPromise('typings utils: skip', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5]), skip<number>(2)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 4, 5]);
    resolve();
  });
});

test.asPromise('typings utils: skipWhile', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3, 2, 1]), skipWhile((x: number) => x < 3)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [3, 2, 1]);
    resolve();
  });
});

test.asPromise('typings utils: take', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5]), take<number>(3)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('typings utils: takeWhile', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5]), takeWhile((x: number) => x < 4)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 2, 3]);
    resolve();
  });
});

test.asPromise('typings utils: takeWithSkip', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5]), takeWithSkip<number>(2, 1)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 3]);
    resolve();
  });
});

test.asPromise('typings utils: fold', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), fold((acc: number, x: number) => acc + x, 0)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [6]);
    resolve();
  });
});

test.asPromise('typings utils: scan', (t, resolve) => {
  const output: number[] = [];
  const c = chain([readableFrom([1, 2, 3]), scan((acc: number, x: number) => acc + x, 0)]);

  c.on('data', (data: number) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [1, 3, 6]);
    resolve();
  });
});

test.asPromise('typings utils: batch', (t, resolve) => {
  const output: number[][] = [];
  const c = chain([readableFrom([1, 2, 3, 4, 5]), batch<number>(2)]);

  c.on('data', (data: number[]) => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [[1, 2], [3, 4], [5]]);
    resolve();
  });
});

test.asPromise('typings utils: reduceStream', (t, resolve) => {
  const rs = reduceStream<number, number>((acc, x) => acc + x, 0);

  const c = chain([readableFrom([1, 2, 3]), rs]);

  c.on('end', () => {
    t.equal(rs.accumulator, 6);
    resolve();
  });
});

test.asPromise('typings utils: readableFrom with array', (t, resolve) => {
  const output: number[] = [];
  const r = readableFrom([10, 20, 30]);

  r.on('data', (data: number) => output.push(data));
  r.on('end', () => {
    t.deepEqual(output, [10, 20, 30]);
    resolve();
  });
});

test.asPromise('typings jsonl: parser in chain', (t, resolve) => {
  const output: unknown[] = [];
  const c = chain([readableFrom(['{"a":1}\n', '{"b":2}\n']), parser()]);

  c.on('data', (item: {key: number; value: unknown}) => output.push(item.value));
  c.on('end', () => {
    t.deepEqual(output, [{a: 1}, {b: 2}]);
    resolve();
  });
});

test.asPromise('typings jsonl: parserStream', (t, resolve) => {
  const output: unknown[] = [];
  const c = chain([readableFrom(['{"a":1}\n', '{"b":2}\n']), parserStream()]);

  c.on('data', (item: {key: number; value: unknown}) => output.push(item.value));
  c.on('end', () => {
    t.deepEqual(output, [{a: 1}, {b: 2}]);
    resolve();
  });
});

test.asPromise('typings jsonl: stringerStream', (t, resolve) => {
  const output: string[] = [];
  const c = chain([readableFrom([{a: 1}, {b: 2}]), stringerStream({separator: '\n'})]);

  c.on('data', (data: string) => output.push(data));
  c.on('end', () => {
    t.equal(output.join(''), '{"a":1}\n{"b":2}');
    resolve();
  });
});
