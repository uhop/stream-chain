'use strict';

import test from 'tape-six';

import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';

import parseFile from '../../src/jsonl/file/parser.js';
import stringerToFile from '../../src/jsonl/file/stringer.js';
import drain from '../../src/utils/drain.js';
import pipe from '../../src/utils/pipe.js';

const mkTmp = async () => mkdtemp(join(tmpdir(), 'stream-chain-jsonl-'));

const makeObjects = (n, seed = 0) => {
  const out = [];
  for (let i = 0; i < n; ++i) {
    out.push({
      i: i + seed,
      s: `row-${i}`,
      arr: [1, 2, 3, i],
      nested: {flag: (i & 1) === 0, msg: 'hello\tworld\n'}
    });
  }
  return out;
};

const toJsonl = objects => objects.map(o => JSON.stringify(o)).join('\n');

test.asPromise('parseFile: reads and parses a JSONL file', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const objects = makeObjects(50);
    const path = join(dir, 'in.jsonl');
    await writeFile(path, toJsonl(objects), 'utf8');

    const out = [];
    for await (const v of pipe(parseFile())(path)) out.push(v);

    t.equal(out.length, objects.length);
    t.deepEqual(
      out.map(r => r.value),
      objects
    );
    t.deepEqual(
      out.map(r => r.key),
      Array.from({length: objects.length}, (_, i) => i)
    );
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('parseFile: handles trailing newline', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const objects = makeObjects(5);
    const path = join(dir, 'in.jsonl');
    await writeFile(path, toJsonl(objects) + '\n', 'utf8');

    const out = [];
    for await (const v of pipe(parseFile())(path)) out.push(v);

    t.equal(out.length, objects.length);
    t.deepEqual(
      out.map(r => r.value),
      objects
    );
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('parseFile: respects errorIndicator', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const path = join(dir, 'in.jsonl');
    await writeFile(path, '{\n1\n]\n2\n3', 'utf8');

    const out = [];
    for await (const v of pipe(parseFile({errorIndicator: undefined}))(path)) out.push(v);

    t.deepEqual(out, [
      {key: 0, value: 1},
      {key: 1, value: 2},
      {key: 2, value: 3}
    ]);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('parseFile: respects small readBlockSize (multi-block read)', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const objects = makeObjects(200);
    const path = join(dir, 'in.jsonl');
    await writeFile(path, toJsonl(objects), 'utf8');

    const out = [];
    for await (const v of pipe(parseFile({readBlockSize: 64}))(path)) out.push(v);

    t.equal(out.length, objects.length);
    t.deepEqual(
      out.map(r => r.value),
      objects
    );
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('stringerToFile: writes JSONL via gen pipeline', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const objects = makeObjects(30);
    const path = join(dir, 'out.jsonl');

    const c = pipe(async function* (src) {
      for (const o of src) yield o;
    }, stringerToFile(path));
    await drain(c(objects));

    const text = await readFile(path, 'utf8');
    t.equal(text, toJsonl(objects));
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise('roundtrip: parseFile → identity → stringerToFile', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const objects = makeObjects(100);
    const inPath = join(dir, 'in.jsonl');
    const outPath = join(dir, 'out.jsonl');
    await writeFile(inPath, toJsonl(objects), 'utf8');

    const c = pipe(parseFile(), r => r.value, stringerToFile(outPath));
    await drain(c(inPath));

    const text = await readFile(outPath, 'utf8');
    t.equal(text, toJsonl(objects));
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});

test.asPromise(
  'stringerToFile: small writeBlockSize flushes multiple times',
  async (t, resolve) => {
    const dir = await mkTmp();
    try {
      const objects = makeObjects(50);
      const path = join(dir, 'out.jsonl');

      const c = pipe(
        async function* (src) {
          for (const o of src) yield o;
        },
        stringerToFile(path, {writeBlockSize: 128})
      );
      await drain(c(objects));

      const text = await readFile(path, 'utf8');
      t.equal(text, toJsonl(objects));
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
    resolve();
  }
);

test.asPromise('stringerToFile: empty input produces empty file', async (t, resolve) => {
  const dir = await mkTmp();
  try {
    const path = join(dir, 'out.jsonl');

    const c = pipe(async function* (src) {
      for (const o of src) yield o;
    }, stringerToFile(path));
    await drain(c([]));

    const text = await readFile(path, 'utf8');
    t.equal(text, '');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
  resolve();
});
