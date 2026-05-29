'use strict';

import test from 'tape-six';

import jsonlStringer, {stringer, jsonlStringer as named} from '../../src/web/jsonl/stringer.js';
import {jsonlStringer as barrelStringer} from '../../src/web/jsonl/index.js';

test('jsonl web stringer: surface (browser-safe)', t => {
  t.equal(typeof jsonlStringer, 'function');
  t.equal(stringer, jsonlStringer, 'named stringer === default');
  t.equal(named, jsonlStringer, 'named jsonlStringer === default');
  t.equal(barrelStringer, jsonlStringer, 'barrel jsonlStringer === default');
  t.equal(jsonlStringer.asWebStream, jsonlStringer, '.asWebStream is the factory itself');
  t.equal(jsonlStringer.asStream, undefined, 'no .asStream on the web entry');
  t.equal(jsonlStringer.stringer, undefined, 'no .stringer self-alias');
});

test.asPromise('jsonl web stringer: round-trips objects -> JSONL text', async (t, resolve) => {
  const objects = [{a: 1}, {b: 2}];
  const ts = jsonlStringer();
  const writePromise = (async () => {
    const writer = ts.writable.getWriter();
    for (const o of objects) await writer.write(o);
    await writer.close();
  })();
  let text = '';
  for await (const s of ts.readable) text += s;
  await writePromise;
  t.equal(text, objects.map(o => JSON.stringify(o)).join('\n'));
  resolve();
});
