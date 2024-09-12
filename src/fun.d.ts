import type {Many, Flatten} from './defs';
import type {Arg0, Ret, FnList} from './gen';

export = fun;

declare function fun(): (arg: any) => Many<any> | any;
declare function fun<L extends unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): Flatten<L> extends readonly [function, ...function[]]
  ? (arg: Arg0<L>) => Many<Ret<L>> | Ret<L>
  : (arg: any) => Many<any> | any;
