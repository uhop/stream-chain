import chain, {type Arg0, type Ret, type ChainItem} from 'stream-chain';

import parser from 'stream-chain/jsonl/parser.js';
import parserStream from 'stream-chain/jsonl/parserStream.js';
import stringerStream from 'stream-chain/jsonl/stringerStream.js';

import fs, { createReadStream, createWriteStream } from 'node:fs';

const pipeline1 = chain([
  createReadStream('input.json'),
  parser(),
  ({value}: {value: number}) => value + 1,
  stringerStream(),
  createWriteStream('output.json')
] as const);

void pipeline1;

const pipeline2 = chain([
  createReadStream('input.json'),
  parserStream(),
  ({value}: {value: number}) => value + 1,
  stringerStream(),
  createWriteStream('output.json')
] as const);

void pipeline2;
