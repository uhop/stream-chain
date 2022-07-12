const {Writable, Transform} = require('stream');

const makeStreamT = id => {
  const stream = new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(chunk, encoding, callback) {
      console.log(id + ':', 'transform', chunk, encoding);
      const flag = this.push(chunk, encoding);
      console.log(id + ':', 'transform-push', flag);
      callback(null);
    },
    flush(callback) {
      console.log(id + ':', 'flush');
      callback(null);
    }
  });
  stream._id = id;
  stream.on('error', error => console.log(id + ':', 'event-error', error));
  stream.on('end', () => console.log(id + ':', 'event-end'));
  stream.on('finish', () => console.log(id + ':', 'event-finish'));
  stream.on('close', () => console.log(id + ':', 'event-close'));
  stream.on('pipe', src => console.log(id + ':', 'event-pipe', src._id));
  stream.on('unpipe', src => console.log(id + ':', 'event-unpipe', src._id));
  return stream;
};

const makeStreamW = id => {
  const stream = new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      console.log(id + ':', 'write', chunk, encoding);
      callback(null);
    },
    final(callback) {
      console.log(id + ':', 'final');
      callback(null);
    },
    destroy(error, callback) {
      console.log(id + ':', 'destroy', error);
      callback(null);
    }
  });
  stream._id = id;
  stream.on('error', error => console.log(id + ':', 'event-error', error));
  stream.on('finish', () => console.log(id + ':', 'event-finish'));
  stream.on('close', () => console.log(id + ':', 'event-close'));
  stream.on('pipe', src => console.log(id + ':', 'event-pipe', src._id));
  stream.on('unpipe', src => console.log(id + ':', 'event-unpipe', src._id));
  return stream;
};

console.log('Creating streams ...');

const a = makeStreamT('A'),
  b = makeStreamT('B'),
  c = makeStreamT('C'),
  w = makeStreamW('W');

console.log('Connecting streams ...');

a.pipe(b).pipe(c).pipe(w);

console.log('Passing a value ...');

a.write({a: 1});
// a.end();

console.log('Destroying B ...');

// a.destroy();
a.unpipe(b);
b.end();

console.log('Done.');
