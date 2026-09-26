// Scaling meter for the JSONL line splitter: one long line fed in 16 KB chunks;
// time must grow linearly with size — a quadratic curve (16x per 4x step) means
// an incomplete line is rescanned from its start on every chunk. The control has
// the largest size in 100-byte lines.
// Run via `npx nano-bench-io bench/jsonl-long-line.js` and read the ratios.
import {none} from '../src/defs.js';
import parser from '../src/jsonl/parser.js';

const feed = async doc => {
  const p = parser();
  let count = 0;
  for (let i = 0; i < doc.length; i += 16384) {
    for await (const _ of p(doc.slice(i, i + 16384))) ++count;
  }
  for await (const _ of p(none)) ++count;
  return count;
};

const K = 1024;
const line = size => '"' + 'a'.repeat(size - 3) + '"\n';
const docs = {
  'line 1M': line(1024 * K),
  'line 4M': line(4096 * K),
  'line 16M': line(16384 * K),
  'lines 16M': line(100).repeat((16384 * K) / 100)
};

export default Object.fromEntries(
  Object.entries(docs).map(([name, doc]) => [
    name,
    async n => {
      for (let i = 0; i < n; ++i) await feed(doc);
    }
  ])
);
