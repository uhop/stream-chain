'use strict';

import test from 'tape-six';

import {pipeline, Duplex, PassThrough, Readable, Writable} from 'node:stream';

import chain from '../../src/index.js';

// Bounded rather than endless so a regression fails instead of hanging the runner.
const makeSource = (state, isAsync) => {
  const body = function* (x) {
    try {
      for (let i = 0; i < 10000; ++i) {
        ++state.produced;
        yield x + i;
      }
    } finally {
      state.released = true;
    }
  };
  if (!isAsync) return body;
  return async function* (x) {
    yield* body(x);
  };
};

const failingSink = accepted =>
  new Writable({
    objectMode: true,
    write(_chunk, _encoding, callback) {
      callback(--accepted < 0 ? new Error('sink failed') : null);
    }
  });

const tearDownInPipeline = (t, resolve, makeStages, isAsync) => {
  const state = {produced: 0, released: false};
  const c = chain(makeStages(makeSource(state, isAsync)));
  pipeline(Readable.from([1]), c, failingSink(3), error => {
    t.equal(error?.message, 'sink failed');
    setTimeout(() => {
      t.ok(
        c.streams.every(s => s.destroyed),
        'every inner stage is destroyed'
      );
      t.ok(state.released, "the source generator's finally ran");
      t.ok(state.produced < 10000, 'the source stopped before its end');
      resolve();
    }, 50);
  });
};

test.asPromise('chain: pipeline teardown releases a fused generator stage', (t, resolve) =>
  tearDownInPipeline(t, resolve, source => [source, x => x])
);

test.asPromise('chain: pipeline teardown releases a fused async generator stage', (t, resolve) =>
  tearDownInPipeline(t, resolve, source => [source, x => x], true)
);

test.asPromise('chain: pipeline teardown destroys every inner stream', (t, resolve) =>
  tearDownInPipeline(t, resolve, source => [source, new PassThrough({objectMode: true}), x => x])
);

test.asPromise('chain: breaking out of for await releases the source', async (t, resolve) => {
  const state = {produced: 0, released: false};
  const c = chain([makeSource(state), x => x]);
  c.end(1);
  for await (const _ of c) break;
  await new Promise(r => setTimeout(r, 50));
  t.ok(
    c.streams.every(s => s.destroyed),
    'every inner stage is destroyed'
  );
  t.ok(state.released, "the source generator's finally ran");
  resolve();
});

test.asPromise('chain: a clean end lets a trailing sink finish', (t, resolve) => {
  const received = [];
  let flushed = false;
  const sink = new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      received.push(chunk);
      callback(null);
    },
    final(callback) {
      setTimeout(() => {
        flushed = true;
        callback(null);
      }, 20);
    }
  });
  const c = chain([x => x * 2, sink]);
  sink.on('close', () => {
    t.ok(flushed, "the sink's final ran to completion");
    t.ok(sink.writableFinished, 'the sink finished instead of being destroyed');
    t.deepEqual(received, [2, 4, 6]);
    resolve();
  });
  c.write(1);
  c.write(2);
  c.end(3);
});

test.asPromise('chain: a clean end lets an output finish its writable side', (t, resolve) => {
  const received = [];
  let flushed = false;
  const output = new Duplex({
    objectMode: true,
    read() {},
    write(chunk, _encoding, callback) {
      received.push(chunk);
      callback(null);
    },
    final(callback) {
      setTimeout(() => {
        flushed = true;
        callback(null);
      }, 20);
    }
  });
  output.push(null); // the readable side ends before the writable side finishes
  const c = chain([x => x * 2, output]);
  c.resume();
  output.on('close', () => {
    t.ok(flushed, "the output's final ran to completion");
    t.ok(output.writableFinished, 'the output finished instead of being destroyed');
    t.deepEqual(received, [2, 4, 6]);
    resolve();
  });
  c.write(1);
  c.write(2);
  c.end(3);
});
