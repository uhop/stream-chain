'use strict';

// gen(), fun(), pipe(), /core chain(), and exec() are general-purpose compositors:
// null and undefined pass through them like any other value. Only the stream
// drivers (asStream, asWebStream, and the Node and Web chains) drop them.

import test from 'tape-six';

import {none, many, finalValue, flushable, getManyValues} from '../../src/defs.js';
import gen from '../../src/gen.js';
import fun from '../../src/fun.js';
import exec from '../../src/exec.js';
import pipe from '../../src/utils/pipe.js';
import chain from '../../src/core/index.js';

const collect = async iterable => {
  const out = [];
  for await (const v of iterable) out.push(v);
  return out;
};

const callFun = async (f, x) => {
  const r = f(x);
  return [...getManyValues(r && typeof r.then == 'function' ? await r : r)];
};

const show = x => 'got ' + x;

test('null: gen() passes null and undefined as input', async t => {
  t.deepEqual(await collect(gen(show)(null)), ['got null']);
  t.deepEqual(await collect(gen(show)(undefined)), ['got undefined']);
});

test('null: gen() passes a returned null and undefined to the next stage', async t => {
  t.deepEqual(await collect(gen(() => null, show)(0)), ['got null']);
  t.deepEqual(await collect(gen(() => undefined, show)(0)), ['got undefined']);
  t.deepEqual(await collect(gen(async () => null, show)(0)), ['got null']);
});

test('null: gen() emits null and undefined from its last stage', async t => {
  t.deepEqual(
    await collect(
      gen(
        x => x,
        () => null
      )(0)
    ),
    [null]
  );
  t.deepEqual(
    await collect(
      gen(
        x => x,
        () => undefined
      )(0)
    ),
    [undefined]
  );
});

test('null: gen() passes null from many() and from a generator', async t => {
  t.deepEqual(await collect(gen(() => many([null, 1]), show)(0)), ['got null', 'got 1']);
  t.deepEqual(
    await collect(
      gen(function* () {
        yield null;
        yield 1;
      }, show)(0)
    ),
    ['got null', 'got 1']
  );
});

test('null: gen() emits a finalValue() of null', async t => {
  t.deepEqual(await collect(gen(() => finalValue(null), show)(0)), [null]);
});

test('null: gen() emits a flush result of undefined', async t => {
  const g = gen(flushable(x => (x === none ? undefined : x)));
  t.deepEqual(await collect(g(1)), [1]);
  t.deepEqual(await collect(g(none)), [undefined]);
});

test('null: fun() passes null and undefined', async t => {
  t.deepEqual(await callFun(fun(show), null), ['got null']);
  t.deepEqual(
    await callFun(
      fun(() => undefined, show),
      0
    ),
    ['got undefined']
  );
  t.deepEqual(
    await callFun(
      fun(
        x => x,
        () => null
      ),
      0
    ),
    [null]
  );
  t.deepEqual(
    await callFun(
      fun(() => many([null, 1]), show),
      0
    ),
    ['got null', 'got 1']
  );
  t.deepEqual(
    await callFun(
      fun(async () => null, show),
      0
    ),
    ['got null']
  );
});

test('null: pipe() passes null and undefined', async t => {
  t.deepEqual(await collect(pipe(show)(null)), ['got null']);
  t.deepEqual(await collect(pipe(() => undefined, show)(0)), ['got undefined']);
  t.deepEqual(
    await collect(
      pipe(
        x => x,
        () => null
      )(0)
    ),
    [null]
  );
});

test('null: /core chain() passes null and undefined from its input and its stages', async t => {
  t.deepEqual(await collect(chain([show])([1, null, undefined])), [
    'got 1',
    'got null',
    'got undefined'
  ]);
  t.deepEqual(await collect(chain([x => (x === 2 ? null : x), show])([1, 2, 3])), [
    'got 1',
    'got null',
    'got 3'
  ]);
});

test('null: an exec() driver passes null and undefined', async t => {
  const out = [],
    push = v => void out.push(v);
  exec(show)(null, push);
  exec(() => undefined, show)(0, push);
  exec(
    x => x,
    () => null
  )(0, push);
  t.deepEqual(out, ['got null', 'got undefined', null]);
});
