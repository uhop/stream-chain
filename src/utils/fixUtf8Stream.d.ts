export = fixUtf8Stream;

type FixOutput = (chunk: string | Buffer) => string;

declare function fixUtf8Stream(): FixOutput;
