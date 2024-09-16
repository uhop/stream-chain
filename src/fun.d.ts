import type {Many, AsFlatList, Arg0, Ret, Fn} from './defs';
import type {FnList} from './gen';

export = fun;

declare function fun(): (arg: any) => Promise<Many<any>>;
declare function fun<L extends unknown[]>(
  ...fns: FnList<Arg0<L>, L>
): AsFlatList<L> extends readonly [Fn, ...Fn[]]
  ? (arg: Arg0<L>) => Promise<Many<Ret<L>>>
  : (arg: any) => Promise<Many<any>>;
