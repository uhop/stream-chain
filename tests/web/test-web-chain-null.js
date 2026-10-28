'use strict';

// asWebStream() and the Web chain() drop null and undefined at every stage, a
// finalValue() of null included, for consistency with asStream().

import test from 'tape-six';

import chain, {asWebStream, gen, finalValue, many} from '../../src/web/index.js';

const run = async ({readable, writable}) => {
  const writer = writable.getWriter();
  const feeding = (async () => {
    for (const x of [1, 2, 3]) await writer.write(x);
    await writer.close();
  })();
  const out = [];
  for await (const v of readable) out.push(v);
  await feeding;
  return out;
};

const show = x => 'got ' + x;

test('web chain null: a function in the middle drops null and undefined', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? null : x), show])), ['got 1', 'got 3']);
  t.deepEqual(await run(chain([x => (x === 2 ? undefined : x), show])), ['got 1', 'got 3']);
});

test('web chain null: the last function drops null', async t => {
  t.deepEqual(await run(chain([show, x => (x === 'got 2' ? null : x)])), ['got 1', 'got 3']);
});

test('web chain null: many() drops null', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? many([null, x]) : x), show])), [
    'got 1',
    'got 2',
    'got 3'
  ]);
});

test('web chain null: a finalValue() of null is dropped', async t => {
  t.deepEqual(await run(chain([x => (x === 2 ? finalValue(null) : x), show])), ['got 1', 'got 3']);
});

test('web chain null: asWebStream() over a gen() drops null at every stage', async t => {
  t.deepEqual(await run(asWebStream(gen(x => (x === 2 ? null : x), show))), ['got 1', 'got 3']);
  t.deepEqual(await run(asWebStream(gen(x => (x === 2 ? finalValue(null) : x), show))), [
    'got 1',
    'got 3'
  ]);
});
