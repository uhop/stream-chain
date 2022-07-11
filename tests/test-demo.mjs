'use strict';

import test from 'tape-six';

import {Transform} from 'stream';
import chain from '../src/index.js';
import readableFrom from '../src/utils/readableFrom.js';

const getTotalFromDatabaseByKey = async x =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve(Math.min(x % 10, 3));
    }, 20);
  });

test.asPromise('demo: default', (t, resolve) => {
  const c = chain([
      // transforms a value
      x => x * x,
      // returns several values
      x => chain.many([x - 1, x, x + 1]),
      // waits for an asynchronous operation
      async x => await getTotalFromDatabaseByKey(x),
      // returns multiple values with a generator
      function* (x) {
        for (let i = x; i > 0; --i) {
          yield i;
        }
        return 0;
      },
      // filters out even values
      x => (x % 2 ? x : null),
      // uses an arbitrary transform stream
      new Transform({
        objectMode: true,
        transform(x, _, callback) {
          callback(null, x + 1);
        }
      })
    ]),
    output = [];
  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});

test.asPromise('demo: no grouping', (t, resolve) => {
  const c = chain(
      [
        // transforms a value
        x => x * x,
        // returns several values
        x => chain.many([x - 1, x, x + 1]),
        // waits for an asynchronous operation
        async x => await getTotalFromDatabaseByKey(x),
        // returns multiple values with a generator
        function* (x) {
          for (let i = x; i > 0; --i) {
            yield i;
          }
          return 0;
        },
        // filters out even values
        x => (x % 2 ? x : null),
        // uses an arbitrary transform stream
        new Transform({
          objectMode: true,
          transform(x, _, callback) {
            callback(null, x + 1);
          }
        })
      ],
      {noGrouping: true}
    ),
    output = [];
  c.on('data', data => output.push(data));
  c.on('end', () => {
    t.deepEqual(output, [2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2]);
    resolve();
  });

  readableFrom([1, 2, 3]).pipe(c);
});
