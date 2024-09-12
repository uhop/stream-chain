import {
  isFinalValue,
  finalValue,
  getFinalValue
} from 'stream-chain/defs.js';

{
  const x = finalValue(42);
  if (isFinalValue(x)) {
    const t = getFinalValue(x);
    void t;
  }
  const z = getFinalValue(x);
  void z;

  const w = {};
  if (isFinalValue(w)) {
    const t = getFinalValue(w);
    void t;
  }
  // const v = getFinalValue(w);
  // void v;
}
