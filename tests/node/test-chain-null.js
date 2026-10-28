'use strict';

// Node streams reserve null for the end of a stream, so chain() and asStream()
// drop null and undefined at every stage, a finalValue() of null included.

import test from 'tape-six';

import chain from '../../src/index.js';
import asStream from '../../src/asStream.js';
import gen from '../../src/gen.js';
import {finalValue, many} from '../../src/defs.js';

const run = stream =>
  new Promise((resolve, reject) => {
    const out = [];
    stream.on('data', d => out.push(d));
    stream.on('error', reject);
    stream.on('end', () => resolve(out));
    for (const x of [1, 2, 3]) stream.write(x);
    stream.end();
  });

const show = x => 'got ' + x;

test('chain null: a function in the middle drops null and undefined', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? null : x), show])), ['got 1', 'got 3']);
  t.deepEqual(await run(chain([x => (x === 2 ? undefined : x), show])), ['got 1', 'got 3']);
});

test('chain null: the last function drops null', async t => {
  t.deepEqual(await run(chain([show, x => (x === 'got 2' ? null : x)])), ['got 1', 'got 3']);
});

test('chain null: many() and a generator drop null', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? many([null, x]) : x), show])), [
    'got 1',
    'got 2',
    'got 3'
  ]);
  t.deepEqual(
    await run(
      chain([
        function* (x) {
          if (x === 2) yield null;
          yield x;
        },
        show
      ])
    ),
    ['got 1', 'got 2', 'got 3']
  );
});

test('chain null: a finalValue() of null is dropped and the stream goes on', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? finalValue(null) : x), show])), ['got 1', 'got 3']);
});

test('chain null: asStream() over a gen() drops null at every stage', async t => {
  t.deepEqual(await run(asStream(gen(x => (x === 2 ? null : x), show))), ['got 1', 'got 3']);
  t.deepEqual(await run(asStream(gen(x => (x === 2 ? finalValue(null) : x), show))), [
    'got 1',
    'got 3'
  ]);
});
