
const {PassThrough} = require('stream');

const defs = require('./defs');
const {make: makeStream} = require('./src/AsStream');

const s = makeStream(x => x * x);
// const s = makeStream(async x => x * x);
// const s = makeStream(function* (x) { for (let i = 0; i < x; ++i) yield i; });
// const s = makeStream(async function* (x) { for (let i = 0; i < x; ++i) yield i; });

// const s = makeStream(x => defs.none);
// const s = makeStream(x => defs.finalValue(42));
// const s = makeStream(x => defs.many(['a', x, 'b']));
// const s = makeStream(x => defs.stop);

const h = new PassThrough({writableObjectMode: true, readableObjectMode: true});
const p = h.pipe(s);

p.on('data', data => console.log('DATA:', data));
p.on('end', () => console.log('END'));

h.write(1);
h.write(2);
h.write(3);
h.write(4);
h.end();
