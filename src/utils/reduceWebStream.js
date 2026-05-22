// @ts-self-types="./reduceWebStream.d.ts"

const defaultInitial = 0;
const defaultReducer = (_acc, value) => value;

const reduceWebStream = (options, initial) => {
  if (typeof options === 'function') {
    options = {reducer: options, initial};
  }
  const reducer = typeof options?.reducer === 'function' ? options.reducer : defaultReducer;
  let accumulator = options && 'initial' in options ? options.initial : defaultInitial;

  const strategy = options?.writableStrategy ?? options?.strategy;

  let resolveResult, rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const ctx = {
    get accumulator() {
      return accumulator;
    }
  };

  const writable = new WritableStream(
    {
      async write(chunk) {
        try {
          const r = reducer.call(ctx, accumulator, chunk);
          accumulator = r && typeof r.then === 'function' ? await r : r;
        } catch (error) {
          rejectResult(error);
          throw error;
        }
      },
      close() {
        resolveResult(accumulator);
      },
      abort(reason) {
        rejectResult(reason);
      }
    },
    strategy
  );

  ctx.writable = writable;
  ctx.result = result;

  return ctx;
};

export default reduceWebStream;
export {reduceWebStream};
