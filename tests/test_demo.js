'use strict';

const unit = require('heya-unit');

const Chain = require('../index');
const {streamFromArray} = require('./helpers');
const {Transform} = require('stream');

unit.add(module, [
  function test_demo(t) {
    const async = t.startAsync('test_demo');

    const getTotalFromDatabaseByKey = async x =>
      new Promise(resolve => {
        setTimeout(() => {
          resolve(Math.min(x % 10, 3));
        }, 20);
      });

    const chain = new Chain([
        // transforms a value
        x => x * x,
        // returns several values
        x => [x - 1, x, x + 1],
        // waits for an asynchronous operation
        async x => await getTotalFromDatabaseByKey(x),
        // returns multiple values with a generator
        function*(x) {
          for (let i = x; i > 0; --i) {
            yield i;
          }
          return 0;
        },
        // filters out even values
        x => (x % 2 ? x : null),
        // uses an arbitrary transform stream
        new Transform({
          objectMode: true,
          transform(x, _, callback) {
            callback(null, x + 1);
          }
        })
      ]),
      output = [];
    chain.on('data', data => output.push(data));
    chain.on('end', () => {
      eval(t.TEST('t.unify(output, [2, 2, 4, 2, 4, 2, 4, 2, 4, 2, 4, 2])'));
      async.done();
    });

    streamFromArray([1, 2, 3]).pipe(chain);
  }
]);
