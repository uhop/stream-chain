import gen from 'stream-chain/gen.js';

const g0 = gen();
const g1 = gen((x: number) => x * x);
const g2 = gen(
  (x: number) => x * x,
  (x: number) => String(x).split(' ')
);
const g3 = gen(
  (x: number) => x * x,
  [g0, g1, g2] as const,
  (x: string[]) => x[0],
  [null, undefined] as const,
  (x: string) => !x.split(' '),
  (x: boolean) => !x
);
const g4 = gen([
  (x: number) => x * x,
  [g0, g1, g2],
  (x: string[]) => x[0],
  [null, undefined],
  (x: string) => !x.split(' '),
  (x: boolean) => !x
] as const);
const g5 = gen(
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

const fns: ((arg: any) => any)[] = [g3, (x: boolean) => Number(x), g4];
const g6 = gen(...fns);
const g7 = gen(
  function* () {
    for (let i = 0; i < 10; ++i) {
      yield i;
    }
  },
  g6
);

void g5;
void g7;

const g8 = gen(...[g3, (x: boolean) => Number(x), g4]);
const g9 = gen(...[g3, (x: boolean) => Number(x), g4] as ((arg: any) => any)[]);

void g8;
void g9;

const g10 = gen(null);
const g11 = gen(undefined, null);

void g10;
void g11;
