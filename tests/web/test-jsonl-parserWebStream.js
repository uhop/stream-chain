'use strict';

import test from 'tape-six';

import parserWebStream from '../../src/jsonl/parserWebStream.js';
import stringerWebStream from '../../src/jsonl/stringerWebStream.js';
import reduceWebStream from '../../src/utils/reduceWebStream.js';

const drainKeys = async readable => {
  const out = [];
  for await (const v of readable) out.push(v);
  return out;
};

const writeAll = async (writable, chunks) => {
  const writer = writable.getWriter();
  for (const c of chunks) await writer.write(c);
  await writer.close();
};

test.asPromise('parserWebStream: smoke test', async (t, resolve) => {
  const a = {x: 1},
    b = {y: 2},
    c = {z: 3};
  const input = [a, b, c].map(v => JSON.stringify(v)).join('\n');

  const parser = parserWebStream();
  const writePromise = writeAll(parser.writable, [input]);
  const out = await drainKeys(parser.readable);
  await writePromise;

  t.deepEqual(
    out,
    [a, b, c].map((value, key) => ({key, value}))
  );
  resolve();
});

test.asPromise(
  'parserWebStream: chunked input across multi-byte boundaries',
  async (t, resolve) => {
    // Pipe through bytes split at arbitrary points; fixUtf8Stream + lines reassemble.
    const objects = [{n: 1}, {s: '日本語'}, {n: 2}];
    const json = objects.map(o => JSON.stringify(o)).join('\n');
    const bytes = new TextEncoder().encode(json);

    // Split into byte windows of size 3 to force multi-byte interior splits.
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 3) chunks.push(bytes.slice(i, i + 3));

    const parser = parserWebStream();
    const writePromise = writeAll(parser.writable, chunks);
    const out = await drainKeys(parser.readable);
    await writePromise;

    t.deepEqual(
      out.map(o => o.value),
      objects
    );
    resolve();
  }
);

test.asPromise('parserWebStream: bad JSON propagates as error', async (t, resolve) => {
  const parser = parserWebStream();
  writeAll(parser.writable, [' not json ']).catch(() => {});

  const reader = parser.readable.getReader();
  try {
    await reader.read();
    t.fail('reader should reject on bad json');
  } catch (e) {
    t.ok(e, 'reader sees the parse error');
  }
  resolve();
});

test.asPromise('parserWebStream: ignoreErrors drops bad lines', async (t, resolve) => {
  const good = {a: 1};
  const input = ['not json', JSON.stringify(good), 'also not json'].join('\n');

  const parser = parserWebStream({ignoreErrors: true});
  writeAll(parser.writable, [input]).catch(() => {});
  const out = await drainKeys(parser.readable);

  // Bad lines map to `defs.none` inside the parser and are filtered out by
  // asWebStream — no envelope reaches userland. `key` preserves the source
  // line index of the surviving record (good is line 1).
  t.equal(out.length, 1, 'only valid lines emit');
  t.deepEqual(out[0], {key: 1, value: good});
  resolve();
});

test.asPromise('parserWebStream: reviver applied per line', async (t, resolve) => {
  const input = JSON.stringify({n: 5});
  const parser = parserWebStream({
    reviver: (_k, v) => (typeof v === 'number' ? v * 2 : v)
  });
  writeAll(parser.writable, [input]).catch(() => {});
  const out = await drainKeys(parser.readable);
  t.deepEqual(out[0].value, {n: 10});
  resolve();
});

test.asPromise('parserWebStream: roundtrip via stringerWebStream', async (t, resolve) => {
  // pipeThrough composition test: bytes → parserWebStream → unwrap → stringerWebStream → bytes.
  const objects = [{a: 1}, {b: 2}, {c: 3}];
  const input = objects.map(o => JSON.stringify(o)).join('\n');

  const parser = parserWebStream();
  const stringer = stringerWebStream();
  const collector = reduceWebStream((acc, chunk) => acc + chunk, '');

  // bytes → parser → strip {key,value} wrapper → stringer → collector
  writeAll(parser.writable, [input]).catch(() => {});
  parser.readable
    .pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk.value);
        }
      })
    )
    .pipeThrough(stringer)
    .pipeTo(collector.writable)
    .catch(() => {});

  t.equal(await collector.result, input);
  resolve();
});

test.asPromise('parserWebStream: has Web duplex shape', (t, resolve) => {
  const p = parserWebStream();
  t.ok(p.readable, 'has readable');
  t.ok(p.writable, 'has writable');
  t.equal(typeof p.readable.pipeTo, 'function');
  t.equal(typeof p.writable.getWriter, 'function');
  resolve();
});
