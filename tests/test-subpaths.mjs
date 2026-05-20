import {test} from 'tape-six';

test.asPromise('subpath /core: chain works and exposes parity surface', async (t, resolve) => {
  const {chain, gen, fun, none, many} = await import('stream-chain/core');

  t.equal(typeof chain, 'function', 'chain exported');
  t.equal(typeof gen, 'function', 'gen exported');
  t.equal(typeof fun, 'function', 'fun exported');
  t.equal(typeof none, 'symbol', 'none exported');
  t.equal(typeof many, 'function', 'many exported');

  const c = chain([x => x * 2, x => x + 1]);
  t.equal(typeof c, 'function', 'chain([...]) returns callable');
  t.equal(c.streams, null, 'streams parity: null');
  t.equal(c.input, null, 'input parity: null');
  t.equal(c.output, null, 'output parity: null');

  const out = [];
  for await (const v of c([1, 2, 3])) out.push(v);
  t.deepEqual(out, [3, 5, 7], 'chain transforms input iterable correctly');

  // statics on chain (override-hook contract + 3.x property access)
  t.equal(chain.gen, gen, 'chain.gen attached');
  t.equal(chain.fun, fun, 'chain.fun attached');
  t.equal(chain.none, none, 'chain.none attached');

  resolve();
});

test.asPromise('subpath /node: chain works and exposes Duplex', async (t, resolve) => {
  const {chain} = await import('stream-chain/node');
  const {readableFrom} = await import('stream-chain/utils/readableFrom.js');

  t.equal(typeof chain, 'function', 'chain exported from /node');
  t.equal(typeof chain.asStream, 'function', 'chain.asStream available in /node');

  const c = chain([readableFrom([1, 2, 3]), x => x * x]);
  t.ok(Array.isArray(c.streams), 'streams populated as array on /node');
  t.ok(c.input, 'input populated on /node');
  t.ok(c.output, 'output populated on /node');

  const out = [];
  c.on('data', d => out.push(d));
  c.on('end', () => {
    t.deepEqual(out, [1, 4, 9], 'Duplex emits transformed values');
    resolve();
  });
});

test.asPromise('subpath /web: placeholder is importable, exports nothing yet', async (t, resolve) => {
  const mod = await import('stream-chain/web');
  t.deepEqual(Object.keys(mod), [], '/web placeholder has no exports in Phase 1');
  resolve();
});

test.asPromise('default entry resolves to /node', async (t, resolve) => {
  const main = await import('stream-chain');
  const node = await import('stream-chain/node');
  t.equal(main.chain, node.chain, 'default entry chain === /node chain');
  t.equal(main.default, node.default, 'default exports identical');
  resolve();
});
