import chain, {asStream, many, none, TypedTransform} from 'stream-chain';
import readableFrom from 'stream-chain/utils/readableFrom.js';

import {Transform} from 'node:stream';

const getTotalFromDatabaseByKey = async (x: number) =>
  new Promise<number>(resolve => {
    setTimeout(() => {
      resolve(Math.min(x % 10, 3));
    }, 20);
  });

const c = chain([
    // transforms a value
    (x: number) => x * x,
    // returns several values
    (x: number) => many([x - 1, x, x + 1]),
    // waits for an asynchronous operation
    async (x: number) => await getTotalFromDatabaseByKey(x),
    // or: (x: number) => getTotalFromDatabaseByKey(x),
    // returns multiple values with a generator
    function* (x: number) {
      for (let i = x; i >= 0; --i) {
        yield i;
      }
    },
    // filters out even values
    (x: number) => (x % 2 ? x : none),
    // uses an arbitrary transform stream
    new Transform({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, x + 1);
      }
    }),
    // can skip falsy values
    [null, undefined],
    // uses a typed transform stream
    new TypedTransform<number, string>({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, String(x + 1));
      }
    }),
    // uses a wrapped function
    asStream((x: string) => !x)
  ] as const),
  output: boolean[] = [];
c.on('data', (data: boolean) => output.push(data));

readableFrom([1, 2, 3]).pipe(c);
