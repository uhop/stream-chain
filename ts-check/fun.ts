import fun from 'stream-chain/fun.js';

const f0 = fun();
const f1 = fun((x: number) => x * x);
const f2 = fun(
  (x: number) => x * x,
  (x: number) => String(x).split(' ')
);
const f3 = fun(
  (x: number) => x * x,
  [f0, f1, f2] as const,
  (x: string[]) => x[0],
  [null, undefined] as const,
  (x: string) => !x.split(' '),
  (x: boolean) => !x
);
const f4 = fun([
  (x: number) => x * x,
  [f0, f1, f2],
  (x: string[]) => x[0],
  [null, undefined],
  (x: string) => !x.split(' '),
  (x: boolean) => !x
] as const);
const f5 = fun(
  async (x: number) => x * x,
  function* (x: number) {
    yield* [x - 1, x, x + 1];
  },
  async function* (x: number) {
    for (let i = x; i > 0; --i) {
      yield i;
    }
  },
  (x: any) => String(x)
);

const fns: ((arg: any) => any)[] = [f3, (x: boolean) => Number(x), f4];
const f6 = fun(...fns);
const f7 = fun(
  function* () {
    for (let i = 0; i < 10; ++i) {
      yield i;
    }
  },
  f6
);

void f5;
void f7;
