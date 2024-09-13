import type {Many, Flatten, Arg0, Ret, Fn} from './defs';
import type {FnList} from './gen';

export = fun;

declare function fun(): (arg: any) => Promise<Many<any>>;
declare function fun<L extends unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): Flatten<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => Promise<Many<Ret<L>>>
  : (arg: any) => Promise<Many<any>>;
