
const {PassThrough} = require('node:stream');

const defs = require('../../src/defs');
const asStream = require('../../src/AsStream');

const s = asStream(x => x * x);
// const s = asStream(async x => x * x);
// const s = asStream(function* (x) { for (let i = 0; i < x; ++i) yield i; });
// const s = asStream(async function* (x) { for (let i = 0; i < x; ++i) yield i; });

// const s = asStream(x => defs.none);
// const s = asStream(x => defs.finalValue(42));
// const s = asStream(x => defs.many(['a', x, 'b']));
// const s = asStream(x => defs.stop);

const h = new PassThrough({writableObjectMode: true, readableObjectMode: true});
const p = h.pipe(s);

p.on('data', data => console.log('DATA:', data));
p.on('end', () => console.log('END'));

h.write(1);
h.write(2);
h.write(3);
h.write(4);
h.end();
