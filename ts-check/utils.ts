import chain from 'stream-chain';

import skip from 'stream-chain/utils/skip.js';
import skipWhile from 'stream-chain/utils/skipWhile.js';
import take from 'stream-chain/utils/take.js';
import takeWhile from 'stream-chain/utils/takeWhile.js';
import takeWithSkip from 'stream-chain/utils/takeWithSkip.js';

import fold from 'stream-chain/utils/fold.js';
import scan from 'stream-chain/utils/scan.js';

import reduceStream from 'stream-chain/utils/reduceStream.js';

import batch from 'stream-chain/utils/batch.js';

const pipeline1 = chain([
  skipWhile((x: number) => x < 3),
  takeWhile((x: number) => x > 0),
  skip<number>(2),
  take<number>(10),
  takeWithSkip<number>(5, 2),
  scan((acc: number, x: number) => acc + x, 0),
  fold((acc: string, x: number) => acc + x, '')
] as const);
void pipeline1;

const pipeline2 = chain([
  batch<number>(10),
  reduceStream((acc: number, x: number[]) => acc + x.length, 0)
] as const);
void pipeline2;
