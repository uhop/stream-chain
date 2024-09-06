import {none} from '../defs';

export = lines;

type LinesOutput = (value: string | none) => IterableIterator<string>;

declare function lines(): LinesOutput;
