import {test} from 'tape-six';

import chain, {asWebStream, gen, fun, many, none} from '../src/web/index.js';

// Drain a ReadableStream into an array.
const collect = async (readable) => {
  const out = [];
  const reader = readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
};

// Feed an array of values into a WritableStream and close.
const feed = async (writable, values) => {
  const writer = writable.getWriter();
  for (const v of values) await writer.write(v);
  await writer.close();
};

test.asPromise('/web chain: basic function pipeline', async (t, resolve) => {
  const c = chain([x => x * 2, x => x + 1]);
  t.ok(c.readable, 'has readable');
  t.ok(c.writable, 'has writable');
  // Consecutive functions group into a single asWebStream(gen(...)) stage — fast path.
  t.equal(c.streams.length, 1, 'consecutive functions grouped into 1 stage (perf path)');

  const collectP = collect(c.readable);
  await feed(c.writable, [1, 2, 3]);
  t.deepEqual(await collectP, [3, 5, 7], 'transforms each value through pipeline');
  resolve();
});

test.asPromise('/web chain: async functions', async (t, resolve) => {
  const c = chain([
    async x => x * 2,
    async x => x + 100
  ]);
  const collectP = collect(c.readable);
  await feed(c.writable, [1, 2, 3]);
  t.deepEqual(await collectP, [102, 104, 106], 'async functions work');
  resolve();
});

test.asPromise('/web chain: gen produces multiple outputs per input', async (t, resolve) => {
  const c = chain([
    gen(x => x * 10, x => x + 1, x => many([x, x + 0.5]))
  ]);
  const collectP = collect(c.readable);
  await feed(c.writable, [1, 2]);
  t.deepEqual(await collectP, [11, 11.5, 21, 21.5], 'many emits multiple values per input');
  resolve();
});

test.asPromise('/web chain: none filters', async (t, resolve) => {
  const c = chain([
    x => (x % 2 === 0 ? x : none),
    x => x * 100
  ]);
  const collectP = collect(c.readable);
  await feed(c.writable, [1, 2, 3, 4, 5]);
  t.deepEqual(await collectP, [200, 400], 'none filters out odd values');
  resolve();
});

test.asPromise('/web chain: mixed fun → gen → asWebStream → fun', async (t, resolve) => {
  // The mixed-executor test the design doc names explicitly.
  const wrappedStream = asWebStream(x => x + ' middle');
  const c = chain([
    fun(x => x * 2),
    gen(x => x.toString()),
    wrappedStream,
    fun(x => '[' + x + ']')
  ]);
  const collectP = collect(c.readable);
  await feed(c.writable, [1, 2, 3]);
  t.deepEqual(
    await collectP,
    ['[2 middle]', '[4 middle]', '[6 middle]'],
    'mixed fun/gen/asWebStream/fun dispatches correctly'
  );
  resolve();
});

test.asPromise('/web chain: accepts ReadableStream as source (first item)', async (t, resolve) => {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(10);
      controller.enqueue(20);
      controller.enqueue(30);
      controller.close();
    }
  });
  const c = chain([source, x => x / 10]);
  t.equal(c.writable, null, 'no writable when first item is a source');
  const out = await collect(c.readable);
  t.deepEqual(out, [1, 2, 3], 'pulls from source through pipeline');
  resolve();
});

test.asPromise('/web chain: accepts WritableStream as sink (last item)', async (t, resolve) => {
  const out = [];
  const sink = new WritableStream({
    write(value) {
      out.push(value);
    }
  });
  const c = chain([x => x + 1, sink]);
  t.equal(c.readable, null, 'no readable when last item is a sink');
  await feed(c.writable, [1, 2, 3]);
  // give the pipeTo a tick to drain
  await new Promise(r => setTimeout(r, 10));
  t.deepEqual(out, [2, 3, 4], 'sink receives transformed values');
  resolve();
});

test.asPromise('/web chain: source + transforms + sink (self-contained)', async (t, resolve) => {
  const out = [];
  const source = new ReadableStream({
    start(controller) {
      [5, 10, 15].forEach(v => controller.enqueue(v));
      controller.close();
    }
  });
  const sink = new WritableStream({
    write(value) {
      out.push(value);
    }
  });
  chain([source, x => x * 2, sink]);
  // Wait for the chain to drain.
  await new Promise(r => setTimeout(r, 20));
  t.deepEqual(out, [10, 20, 30], 'self-contained chain runs');
  resolve();
});

test.asPromise('/web chain: ChainOutput shape parity (streams/input/output populated)', async (t, resolve) => {
  // Use a Web stream between functions to defeat grouping so we get 3 distinct stages.
  const wrapped = asWebStream(x => x.toString());
  const c = chain([x => x + 1, wrapped, x => '[' + x + ']']);
  t.equal(c.streams.length, 3, 'three distinct stages');
  t.ok(c.input, 'input populated');
  t.ok(c.output, 'output populated');
  t.equal(c.input, c.streams[0], 'input === first stage');
  t.equal(c.output, c.streams[c.streams.length - 1], 'output === last stage');
  resolve();
});

test.asPromise('/web asWebStream: passes Web stream objects through unchanged', (t, resolve) => {
  const r = new ReadableStream();
  t.equal(asWebStream(r), r, 'ReadableStream passes through');

  const w = new WritableStream();
  t.equal(asWebStream(w), w, 'WritableStream passes through');

  const tx = new TransformStream();
  t.equal(asWebStream(tx), tx, '{readable, writable} pair passes through');

  resolve();
});

test.asPromise('/web asWebStream: wraps a function as TransformStream', async (t, resolve) => {
  const ts = asWebStream(x => x * 10);
  t.ok(ts.readable, 'has readable');
  t.ok(ts.writable, 'has writable');

  const collectP = collect(ts.readable);
  await feed(ts.writable, [1, 2, 3]);
  t.deepEqual(await collectP, [10, 20, 30], 'wrapped function runs');
  resolve();
});

test.asPromise('/web chain: chain.asWebStream attached (override-hook parity)', (t, resolve) => {
  t.equal(typeof chain.asWebStream, 'function', 'chain.asWebStream attached');
  t.equal(chain.asWebStream, asWebStream, 'chain.asWebStream === asWebStream');
  resolve();
});
