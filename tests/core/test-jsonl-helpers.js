'use strict';

import test from 'tape-six';

import {none} from '../../src/defs.js';
import parser, {jsonlParser} from '../../src/jsonl/parser.js';

test('jsonl jsonlParser: raw factory parses one line at a time', t => {
  const p = jsonlParser();
  t.deepEqual(p('1'), {key: 0, value: 1});
  t.deepEqual(p('"x"'), {key: 1, value: 'x'});
  t.deepEqual(p('{"k":2}'), {key: 2, value: {k: 2}});
});

test('jsonl jsonlParser: empty line returns none', t => {
  const p = jsonlParser();
  t.equal(p(''), none);
});

test('jsonl jsonlParser: throws on bad input without errorIndicator', t => {
  const p = jsonlParser();
  t.throws(() => p('{not json'));
});

test('jsonl jsonlParser: errorIndicator undefined drops, errorIndicator null replaces', t => {
  const dropper = jsonlParser({errorIndicator: undefined});
  t.equal(dropper('{'), none);
  t.deepEqual(dropper('1'), {key: 0, value: 1});

  const nuller = jsonlParser({errorIndicator: null});
  t.deepEqual(nuller('{'), {key: 0, value: null});
  t.deepEqual(nuller('1'), {key: 1, value: 1});
});

test('jsonl jsonlParser: function errorIndicator threads through reviver', t => {
  const reviver = (_k, v) => (typeof v == 'number' ? v + 1 : v);
  const p = jsonlParser({
    reviver,
    errorIndicator: (err, input, rev) => ({
      err: err.name,
      input,
      hasReviver: typeof rev == 'function'
    })
  });
  t.deepEqual(p('{'), {
    key: 0,
    value: {err: 'SyntaxError', input: '{', hasReviver: true}
  });
  t.deepEqual(p('2'), {key: 1, value: 3});
});

test('jsonl jsonlParser: reviver shorthand (function as options)', t => {
  const reviver = (_k, v) => (typeof v == 'number' ? v * 10 : v);
  const p = jsonlParser(reviver);
  t.deepEqual(p('{"a":1}'), {key: 0, value: {a: 10}});
});

test('jsonl parser statics: parser.jsonlParser and parser.parser', t => {
  t.equal(parser.jsonlParser, jsonlParser);
  t.equal(parser.parser, parser);
});
