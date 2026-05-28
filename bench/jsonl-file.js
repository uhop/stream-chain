// JSONL file-edge benchmark: gen-based `parseFile` / `stringerToFile` vs.
// the legacy `fs.createReadStream + parserStream` / `chain + stringerStream +
// createWriteStream` pipeline. Same data, same work, same result.
//
// Fixture is generated once at module load: 50k JSONL rows (~6 MB), written
// to a per-process tmpdir; round-trip variants write to a sibling output file
// each iteration. `nano-bench` drives one full pass per measured invocation.
//
// READING THE RESULTS — there are three meaningful shapes here:
//
//   1. `parse:` — drain every token to an external for-await loop / Writable
//      and count. This shape is dominated by the per-token bridge cost: in
//      `parseFile + count` every emitted record crosses the gen async bridge
//      to the for-await consumer; the Node-streams variant's Writable runs
//      inside Node's native Transform→Writable machinery and stays cheaper.
//      Expect parseFile to be SLOWER here. This is the artificial case.
//
//   2. `parse-work:` — same work (sum + count) but the accumulator lives
//      INSIDE the pipeline (a per-record reducer stage). No external token
//      consumer; the parseFile gen-fused executor wins because the bridge
//      sees no traffic. This is the realistic parse-with-work case.
//
//   3. `roundtrip:` — read a JSONL file, pass through, write back. With
//      the file sink terminating the pipeline, neither variant pays the
//      external-consumer bridge cost. The streams variant pays per-chunk
//      Transform/Writable boundary overhead at each stage; parseFile +
//      stringerToFile compose into one fused executor with the file
//      handles as the only I/O edges.
//
// See [[topics/sink-placement-trumps-executor-choice]] for the underlying
// principle (this was the same lesson stream-json saw in its 2026-05-28
// file-edge bench — `parseFile` shines when nothing crosses the gen bridge).

import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {createReadStream, createWriteStream} from 'node:fs';
import {Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import chain from '../src/node/index.js';
import parserStream from '../src/jsonl/parserStream.js';
import stringerStream from '../src/jsonl/stringerStream.js';

import parseFile from '../src/jsonl/file/parser.js';
import stringerToFile from '../src/jsonl/file/stringer.js';
import drain from '../src/utils/drain.js';
import pipe from '../src/utils/pipe.js';

const ROWS = 50000;
const tmp = mkdtempSync(join(tmpdir(), 'sc-jsonl-bench-'));
const inPath = join(tmp, 'in.jsonl');
const outPath = join(tmp, 'out.jsonl');

const rows = [];
for (let i = 0; i < ROWS; ++i) {
  rows.push({
    i,
    s: `row-${i}`,
    arr: [1, 2, 3, i, i * 2, i * 3],
    nested: {flag: (i & 1) === 0, msg: 'hello world ' + i}
  });
}
const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
writeFileSync(inPath, jsonl);

process.on('exit', () => {
  try {
    rmSync(tmp, {recursive: true, force: true});
  } catch {}
});

export default {
  async ['parse: fs.createReadStream + parserStream + count']() {
    return new Promise((resolve, reject) => {
      let count = 0;
      const c = chain([
        createReadStream(inPath),
        parserStream(),
        new Writable({
          objectMode: true,
          write(_, __, cb) {
            ++count;
            cb();
          },
          final(cb) {
            resolve(count);
            cb();
          }
        })
      ]);
      c.on('error', reject);
    });
  },

  async ['parse: parseFile + count']() {
    let count = 0;
    for await (const _ of pipe(parseFile())(inPath)) ++count;
    return count;
  },

  async ['parse: parseFile + count (256 KB blocks)']() {
    let count = 0;
    for await (const _ of pipe(parseFile({readBlockSize: 262144}))(inPath)) ++count;
    return count;
  },

  // Realistic parse-with-work: count + sum + a per-record predicate. The
  // count sink lives INSIDE the gen pipeline, so tokens never cross the
  // gen async bridge to the for-await consumer (only the final reducer
  // state does). The "+ count" variants above are artificial — they pay
  // the bridge cost once per token, which the Node-streams path avoids
  // via its native Transform→Writable chain.

  async ['parse-work: fs.createReadStream + parserStream + sum-and-count']() {
    return new Promise((resolve, reject) => {
      let count = 0,
        sum = 0;
      const c = chain([
        createReadStream(inPath),
        parserStream(),
        new Writable({
          objectMode: true,
          write(r, _, cb) {
            ++count;
            sum += r.value.i;
            cb();
          },
          final(cb) {
            resolve({count, sum});
            cb();
          }
        })
      ]);
      c.on('error', reject);
    });
  },

  async ['parse-work: parseFile + sum-and-count (in-pipeline sink)']() {
    let count = 0,
      sum = 0;
    const c = pipe(parseFile({readBlockSize: 262144}), r => {
      ++count;
      sum += r.value.i;
    });
    await drain(c(inPath));
    return {count, sum};
  },

  async ['roundtrip: fs streams + chain + parserStream + stringerStream']() {
    return pipeline(
      createReadStream(inPath),
      chain([parserStream(), r => r.value, stringerStream()]),
      createWriteStream(outPath)
    );
  },

  async ['roundtrip: parseFile → identity → stringerToFile']() {
    const c = pipe(parseFile(), r => r.value, stringerToFile(outPath));
    await drain(c(inPath));
  },

  async ['roundtrip: parseFile → identity → stringerToFile (256 KB read, 256 KB write)']() {
    const c = pipe(
      parseFile({readBlockSize: 262144}),
      r => r.value,
      stringerToFile(outPath, {writeBlockSize: 262144})
    );
    await drain(c(inPath));
  }
};
