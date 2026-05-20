import gen from 'stream-chain/gen.js';
import fun from 'stream-chain/fun.js';
import chain, {asStream, asWebStream, getManyValues} from 'stream-chain';
import webChain from 'stream-chain/web';

const fns = [x => x - 2, x => x + 1, x => 2 * x, x => x + 2, x => x >> 1];

const g = gen(...fns),
  f = fun(...fns);

export default {
  async gen(n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for await (const x of g(i)) {
        acc += x;
      }
    }
    return acc;
  },
  async fun(n) {
    let acc = 0;
    for (let i = 1; i <= n; ++i) {
      for (const x of getManyValues(await f(i))) {
        acc += x;
      }
    }
    return acc;
  },
  async ['node stream'](n) {
    return new Promise((resolve, reject) => {
      let acc = 0;
      const pipe = chain([
        function* (n) {
          for (let i = 1; i <= n; ++i) {
            yield i;
          }
        },
        asStream(g)
      ]);
      pipe.on('data', x => (acc += x));
      pipe.on('finish', () => resolve(acc));
      pipe.on('error', error => reject(error));
      pipe.end(n);
    });
  },
  async ['web stream'](n) {
    let acc = 0;
    const c = webChain([
      function* (n) {
        for (let i = 1; i <= n; ++i) {
          yield i;
        }
      },
      asWebStream(g)
    ]);
    const writer = c.writable.getWriter();
    const writePromise = writer.write(n).then(() => writer.close());
    const reader = c.readable.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      acc += value;
    }
    await writePromise;
    return acc;
  }
};
