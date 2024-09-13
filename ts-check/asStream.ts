import asStream from 'stream-chain/asStream.js';

const a0 = asStream((x: number) => x * x);
const a1 = asStream((x: boolean) => Promise.resolve(String(x)));

void a0;
void a1;
