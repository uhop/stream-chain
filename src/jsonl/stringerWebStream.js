// @ts-self-types="./stringerWebStream.d.ts"

const stringerWebStream = options => {
  let first = true,
    prefix = '',
    suffix = '',
    separator = '\n',
    emptyValue,
    replacer,
    space;
  if (options) {
    if (typeof options.prefix == 'string') prefix = options.prefix;
    if (typeof options.suffix == 'string') suffix = options.suffix;
    if (typeof options.separator == 'string') separator = options.separator;
    if (typeof options.emptyValue == 'string') emptyValue = options.emptyValue;
    replacer = options.replacer;
    space = options.space;
  }

  const writableStrategy = options && options.writableStrategy;
  const readableStrategy = options && options.readableStrategy;

  return new TransformStream(
    {
      transform(value, controller) {
        const result = JSON.stringify(value, replacer, space);
        if (first) {
          first = false;
          controller.enqueue(prefix + result);
        } else {
          controller.enqueue(separator + result);
        }
      },
      flush(controller) {
        const output = first
          ? typeof emptyValue == 'string'
            ? emptyValue
            : prefix + suffix
          : suffix;
        if (output) controller.enqueue(output);
      }
    },
    writableStrategy,
    readableStrategy
  );
};

export default stringerWebStream;
export {stringerWebStream};
