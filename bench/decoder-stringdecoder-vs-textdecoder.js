// Compares Node's StringDecoder vs the WHATWG TextDecoder on the hot path
// inside fixUtf8Stream: per-chunk streamed decode with a final flush.
//
// Hot path shape: one decoder constructed per stream lifetime, reused across
// all chunks of that stream. So the bench reuses one decoder across the outer
// loop (constructor cost amortized away — same as the real call site).
//
// Three workloads to cover the spectrum:
//   - ascii:        pure ASCII, no continuation bytes (decoder fast-path)
//   - mb-aligned:   multi-byte content, chunk boundaries land between codepoints
//   - mb-split:     multi-byte content, chunk size chosen so multi-byte sequences
//                   straddle boundaries (the case the decoder actually exists for)

import {StringDecoder} from 'node:string_decoder';

const buildChunks = (text, chunkSize) => {
  const buf = Buffer.from(text, 'utf8');
  const chunks = [];
  for (let i = 0; i < buf.length; i += chunkSize) {
    chunks.push(buf.subarray(i, Math.min(i + chunkSize, buf.length)));
  }
  return chunks;
};

const asciiText = ('The quick brown fox jumps over the lazy dog. ' + 'A'.repeat(64)).repeat(20);
const mbText = (
  'Café — naïve résumé. ' +
  '漢字とひらがな、カタカナも。 ' +
  '🎉🚀✨🌍🔥 ' +
  'Здравствуй, мир! '
).repeat(20);

// chunk sizes:
//  - 256 on ASCII: every chunk slices on a codepoint boundary (1-byte cp)
//  - 64 on mb-aligned: large enough that splits are rare
//  - 7 on mb-split: small + odd, virtually every chunk ends mid-multi-byte
const asciiChunks = buildChunks(asciiText, 256);
const mbAlignedChunks = buildChunks(mbText, 64);
const mbSplitChunks = buildChunks(mbText, 7);

const runStringDecoder = (decoder, chunks) => {
  let out = '';
  for (const chunk of chunks) out += decoder.write(chunk);
  out += decoder.end();
  return out;
};

const runTextDecoder = (decoder, chunks) => {
  let out = '';
  for (const chunk of chunks) out += decoder.decode(chunk, {stream: true});
  out += decoder.decode();
  return out;
};

// Sanity: both decoders must produce the same output on every workload.
for (const [name, chunks] of [
  ['ascii', asciiChunks],
  ['mb-aligned', mbAlignedChunks],
  ['mb-split', mbSplitChunks]
]) {
  const sd = runStringDecoder(new StringDecoder(), chunks);
  const td = runTextDecoder(new TextDecoder(), chunks);
  if (sd !== td) throw new Error(`decoder output mismatch for ${name}`);
}

export default {
  'sd:ascii': n => {
    const d = new StringDecoder();
    for (let i = 0; i < n; ++i) runStringDecoder(d, asciiChunks);
  },
  'td:ascii': n => {
    const d = new TextDecoder();
    for (let i = 0; i < n; ++i) runTextDecoder(d, asciiChunks);
  },
  'sd:mb-aligned': n => {
    const d = new StringDecoder();
    for (let i = 0; i < n; ++i) runStringDecoder(d, mbAlignedChunks);
  },
  'td:mb-aligned': n => {
    const d = new TextDecoder();
    for (let i = 0; i < n; ++i) runTextDecoder(d, mbAlignedChunks);
  },
  'sd:mb-split': n => {
    const d = new StringDecoder();
    for (let i = 0; i < n; ++i) runStringDecoder(d, mbSplitChunks);
  },
  'td:mb-split': n => {
    const d = new TextDecoder();
    for (let i = 0; i < n; ++i) runTextDecoder(d, mbSplitChunks);
  }
};
