import {none} from '../defs';

export = lines;

type LinesOutput = (value: string | none) => Generator<string, void, unknown>;

declare function lines(): LinesOutput;
