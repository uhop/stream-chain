export = scan;

type FnArg = (acc: unknown, value: unknown) => unknown;

type ScanOutput = (value: unknown) => unknown;

declare function scan(fn: FnArg, acc: unknown): ScanOutput;
