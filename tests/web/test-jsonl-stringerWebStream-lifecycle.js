'use strict';

import test from 'tape-six';

import stringerWebStream from '../../src/jsonl/stringerWebStream.js';

// Lifecycle / error-propagation tests for stringerWebStream. The underlying
// TransformStream gives us most of these semantics for free; the suite
// documents them and pins the contract.
//
// TransformStream default readableStrategy is hwm=0 — a bare `await writer.write(...)`
// before any reader.read() would block on backpressure forever. Tests below
// either drive read concurrently with write or use pipeTo, never bare
// sequential await write + await read.

test.asPromise('stringerWebStream: writer.abort() errors the readable', async (t, resolve) => {
  const s = stringerWebStream();
  const writer = s.writable.getWriter();
  const reader = s.readable.getReader();

  // Concurrent write/read so the first chunk drains through hwm=0 readable.
  const writeP = writer.write({a: 1});
  await reader.read();
  await writeP;

  await writer.abort(new Error('cancelled'));
  try {
    await reader.read();
    t.fail('reader.read() should reject after writer.abort()');
  } catch (e) {
    t.equal(e?.message, 'cancelled');
  }
  resolve();
});

test.asPromise('stringerWebStream: reader.cancel() causes write to reject', async (t, resolve) => {
  const s = stringerWebStream();
  const writer = s.writable.getWriter();
  const reader = s.readable.getReader();

  await reader.cancel(new Error('consumer done'));
  try {
    await writer.write({a: 1});
    t.fail('writer.write() should reject after reader.cancel()');
  } catch (e) {
    t.ok(e, 'producer learns the cancel');
  }
  resolve();
});

test.asPromise('stringerWebStream: replacer throwing → readable errors', async (t, resolve) => {
  const s = stringerWebStream({
    replacer(_key, value) {
      if (value && typeof value === 'object' && value.bad) throw new Error('replacer-boom');
      return value;
    }
  });
  const writer = s.writable.getWriter();
  const reader = s.readable.getReader();

  writer.write({bad: true}).catch(() => {});

  try {
    await reader.read();
    t.fail('reader.read() should reject on replacer error');
  } catch (e) {
    t.equal(e?.message, 'replacer-boom');
  }
  resolve();
});

test.asPromise('stringerWebStream: empty stream → emptyValue from flush', async (t, resolve) => {
  // Closing without writes still drives the flush() callback — important
  // edge case for the suffix/emptyValue contract.
  const s = stringerWebStream({prefix: '[', suffix: ']', separator: ','});
  const writer = s.writable.getWriter();
  const reader = s.readable.getReader();

  // close() and the first read need to run concurrently because flush enqueues
  // '[]' which sits in the readable's queue at hwm=0.
  const closeP = writer.close();
  const {value, done} = await reader.read();
  await closeP;
  t.equal(value, '[]', 'flush() emits prefix+suffix on empty stream');
  t.notOk(done);
  const tail = await reader.read();
  t.ok(tail.done, 'no further output after flush');
  resolve();
});

test.asPromise('stringerWebStream: pipeThrough integrates cleanly', async (t, resolve) => {
  const source = new ReadableStream({
    start(c) {
      c.enqueue({a: 1});
      c.enqueue({b: 2});
      c.close();
    }
  });
  const chunks = [];
  await source.pipeThrough(stringerWebStream()).pipeTo(
    new WritableStream({
      write(c) {
        chunks.push(c);
      }
    })
  );
  t.equal(chunks.join(''), JSON.stringify({a: 1}) + '\n' + JSON.stringify({b: 2}));
  resolve();
});
