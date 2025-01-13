import {
  none,
  many,
  isMany,
  toMany,
  normalizeMany,
  getManyValues,
  combineMany,
  combineManyMut
} from 'stream-chain/defs.js';

{
  const a = many([]),
    b = many([1]),
    c = many([1, 2]);

  console.assert(getManyValues(a).length === 0);
  console.assert(getManyValues(b).length === 1);
  console.assert(getManyValues(c).length === 2);

  console.assert(normalizeMany(a) === none);
  console.assert(normalizeMany(b) === 1);

  const x = normalizeMany(c);
  console.assert(isMany(x));
  if (isMany(x)) console.assert(getManyValues(x).length === 2);
}

{
  const a = toMany(none),
    b = toMany(1),
    c = toMany(many([])),
    d = toMany(many([1, 2, 3]));

  console.assert(getManyValues(a).length === 0);
  console.assert(getManyValues(b).length === 1);
  console.assert(getManyValues(c).length === 0);
  console.assert(getManyValues(d).length === 3);
}

{
  const a = combineMany(none, none),
    b = combineMany(none, 1),
    c = combineMany(1, none),
    d = combineMany(1, '2'),
    e = combineMany(many([]), many([])),
    f = combineMany(many([]), many([1, 2, 3])),
    g = combineMany(many([1, 2, 3]), many([])),
    h = combineMany(many([1, '2', 3]), many([4, 5, 6]));

  console.assert(getManyValues(a).length === 0);
  console.assert(getManyValues(b).length === 1);
  console.assert(getManyValues(c).length === 1);
  console.assert(getManyValues(d).length === 2);
  console.assert(getManyValues(e).length === 0);
  console.assert(getManyValues(f).length === 3);
  console.assert(getManyValues(g).length === 3);
  console.assert(getManyValues(h).length === 6);
}

{
  const a = combineManyMut(none, none),
    b = combineManyMut(none, 1),
    c = combineManyMut(1, none),
    d = combineManyMut(1, '2'),
    e = combineManyMut(many([]), many([])),
    f = combineManyMut(many([]), many([1, 2, 3])),
    g = combineManyMut(many([1, 2, 3]), many([])),
    h = combineManyMut(many([1, '2', 3]), many([4, 5, 6]));

  console.assert(getManyValues(a).length === 0);
  console.assert(getManyValues(b).length === 1);
  console.assert(getManyValues(c).length === 1);
  console.assert(getManyValues(d).length === 2);
  console.assert(getManyValues(e).length === 0);
  console.assert(getManyValues(f).length === 3);
  console.assert(getManyValues(g).length === 3);
  console.assert(getManyValues(h).length === 6);
}
