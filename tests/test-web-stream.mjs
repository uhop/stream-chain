'use strict';

import test from 'tape-six';

import chain from '../src/index.js';

test.asPromise('web stream: transform', (t, resolve) => {
  if (!globalThis.ReadableStream) {
    resolve();
    return;
  }

  const output = [],
    c = chain([
      new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.close();
        }
      }),
      new TransformStream({
        transform(x, controller) {
          controller.enqueue(x * x);
        }
      }),
      x => 2 * x + 1,
      new WritableStream({
        write(x) {
          output.push(x);
        }
      })
    ]);

  c.on('end', () => {
    t.deepEqual(output, [3, 9, 19]);
    resolve();
  });
});
