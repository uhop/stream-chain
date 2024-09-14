import chain, {many} from 'stream-chain';
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
    (x: number) => getTotalFromDatabaseByKey(x),
    // returns multiple values with a generator
    function* (x: number) {
      for (let i = x; i > 0; --i) {
        yield i;
      }
      return 0;
    },
    // filters out even values
    (x: number) => (x % 2 ? x : null),
    // uses an arbitrary transform stream
    new Transform({
      objectMode: true,
      transform(x, _, callback) {
        callback(null, x + 1);
      }
    })
  ] as const),
  output: number[] = [];
c.on('data', (data: number) => output.push(data));

readableFrom([1, 2, 3]).pipe(c);
