import {test} from 'tape-six';

import chain, {asWebStream} from '../src/node/index.js';
import {readableFrom} from '../src/utils/readableFrom.js';

const collect = async readable => {
  const out = [];
  const reader = readable.getReader();
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
};

test.asPromise('/node asWebStream: materializes a chain as Web Streams duplex pair', async (t, resolve) => {
  const c = chain([readableFrom([1, 2, 3]), x => x * x]);
  const web = asWebStream(c);

  t.ok(web.readable, 'has readable side');
  t.ok(web.writable, 'has writable side');

  const out = await collect(web.readable);
  t.deepEqual(out, [1, 4, 9], 'Web Streams output matches Node chain output');
  resolve();
});

test.asPromise('/node chain.asWebStream attached (override-hook parity)', (t, resolve) => {
  t.equal(typeof chain.asWebStream, 'function', 'chain.asWebStream attached');
  t.equal(chain.asWebStream, asWebStream, 'chain.asWebStream === asWebStream');
  resolve();
});

test.asPromise('/node asWebStream: round-trip Node chain → Web stream → consume', async (t, resolve) => {
  const c = chain([readableFrom([10, 20, 30]), x => x + 1, x => x.toString()]);
  const web = asWebStream(c);
  const out = await collect(web.readable);
  t.deepEqual(out, ['11', '21', '31'], 'round-trip preserves chain semantics');
  resolve();
});
