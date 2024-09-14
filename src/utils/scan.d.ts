export = scan;

declare function scan<A = unknown, T = A>(fn: (acc: A, value: T) => A, acc: A): (value: T) => A;
declare function scan<A = unknown, T = A>(
  fn: (acc: A, value: T) => Promise<A>,
  acc: A
): (value: T) => Promise<A>;
