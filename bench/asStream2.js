// Snapshot of the pre-fix asStream — kept here for old-vs-new benchmarking.
// DO NOT use as the canonical asStream. Imports `../src/defs.js` directly
// because it lives under bench/ to avoid leaking through package.json exports.

import {Duplex} from 'node:stream';
import * as defs from '../src/defs.js';

const asStream = (fn, options) => {
  if (typeof fn != 'function') throw TypeError('Only a function is accepted as the first argument');

  let paused = Promise.resolve(),
    resolvePaused = null;
  const queue = [];

  const resume = () => {
    if (!resolvePaused) return;
    resolvePaused();
    resolvePaused = null;
    paused = Promise.resolve();
  };
  const pause = () => {
    if (resolvePaused) return;
    paused = new Promise(resolve => (resolvePaused = resolve));
  };

  const innerFns = defs.isFunctionList(fn) ? fn.fList : null;

  const applyFns = innerFns
    ? function apply(value, i, push) {
        for (;;) {
          if (value && typeof value.then == 'function') return value.then(v => apply(v, i, push));
          if (value === undefined || value === null || value === defs.none) return;
          if (value === defs.stop) throw new defs.Stop();
          if (defs.isFinalValue(value)) {
            push(defs.getFinalValue(value));
            return;
          }
          if (defs.isMany(value)) {
            const values = defs.getManyValues(value);
            if (i >= innerFns.length) {
              for (let j = 0; j < values.length; ++j) push(values[j]);
              return;
            }
            let pending;
            for (let j = 0; j < values.length; ++j) {
              if (pending) {
                const jj = j;
                pending = pending.then(() => apply(values[jj], i, push));
              } else {
                const result = apply(values[j], i, push);
                if (result) pending = result;
              }
            }
            return pending;
          }
          if (value && typeof value.next == 'function') {
            return (async () => {
              for (;;) {
                let data = value.next();
                if (data && typeof data.then == 'function') data = await data;
                if (data.done) break;
                const result = apply(data.value, i, push);
                if (result) await result;
              }
            })();
          }
          if (i >= innerFns.length) {
            push(value);
            return;
          }
          value = innerFns[i++](value);
        }
      }
    : null;

  let stopped = false;
  let stream = null;

  const pushResults = values => {
    if (values && typeof values.next == 'function') {
      queue.push(values);
      return;
    }
    queue.push(values[Symbol.iterator]());
  };
  const pump = async () => {
    while (queue.length) {
      await paused;
      const gen = queue[queue.length - 1];
      let result = gen.next();
      if (result && typeof result.then == 'function') {
        result = await result;
      }
      if (result.done) {
        queue.pop();
        continue;
      }
      let value = result.value;
      if (value && typeof value.then == 'function') {
        value = await value;
      }
      await sanitize(value);
    }
  };
  const sanitize = async value => {
    if (value === undefined || value === null || value === defs.none) return;
    if (value === defs.stop) throw new defs.Stop();

    if (defs.isMany(value)) {
      pushResults(defs.getManyValues(value));
      return pump();
    }

    if (defs.isFinalValue(value)) {
      value = defs.getFinalValue(value);
      return processValue(value);
    }

    if (!stream.push(value)) {
      pause();
    }
  };
  const processChunk = async (chunk, encoding) => {
    try {
      const value = fn(chunk, encoding);
      await processValue(value);
    } catch (error) {
      if (error instanceof defs.Stop) {
        stream.push(null);
        stopped = true;
        return;
      }
      throw error;
    }
  };
  const processValue = async value => {
    if (value && typeof value.then == 'function') {
      return value.then(value => processValue(value));
    }
    if (value && typeof value.next == 'function') {
      pushResults(value);
      return pump();
    }
    return sanitize(value);
  };

  stream = new Duplex({
    writableObjectMode: true,
    readableObjectMode: true,
    ...options,
    write(chunk, encoding, callback) {
      if (stopped) {
        callback(null);
        return;
      }
      if (applyFns) {
        let backpressure = false;
        let asyncResult;
        try {
          asyncResult = applyFns(chunk, 0, value => {
            if (!stream.push(value)) backpressure = true;
          });
        } catch (error) {
          if (error instanceof defs.Stop) {
            stream.push(null);
            stopped = true;
            callback(null);
            return;
          }
          callback(error);
          return;
        }
        if (asyncResult) {
          asyncResult.then(
            () => callback(null),
            error => {
              if (error instanceof defs.Stop) {
                stream.push(null);
                stopped = true;
                callback(null);
                return;
              }
              callback(error);
            }
          );
          return;
        }
        if (backpressure) {
          pause();
          paused.then(() => callback(null));
        } else {
          callback(null);
        }
        return;
      }
      let value;
      try {
        value = fn(chunk, encoding);
      } catch (error) {
        if (error instanceof defs.Stop) {
          stream.push(null);
          stopped = true;
          callback(null);
          return;
        }
        callback(error);
        return;
      }
      if (
        !(value && (typeof value.then == 'function' || typeof value.next == 'function')) &&
        value !== defs.stop &&
        !defs.isMany(value) &&
        !defs.isFinalValue(value)
      ) {
        if (value !== undefined && value !== null && value !== defs.none) {
          if (!stream.push(value)) {
            pause();
            paused.then(() => callback(null));
            return;
          }
        }
        callback(null);
        return;
      }
      processValue(value).then(
        () => callback(null),
        error => {
          if (error instanceof defs.Stop) {
            stream.push(null);
            stopped = true;
            callback(null);
            return;
          }
          callback(error);
        }
      );
    },
    final(callback) {
      if (applyFns) {
        let backpressure = false;
        let asyncChain;
        try {
          const pushFn = value => {
            if (!stream.push(value)) backpressure = true;
          };
          for (let i = 0; i < innerFns.length; ++i) {
            if (defs.isFlushable(innerFns[i])) {
              if (asyncChain) {
                const ii = i;
                asyncChain = asyncChain.then(() =>
                  applyFns(innerFns[ii](defs.none), ii + 1, pushFn)
                );
              } else {
                const result = applyFns(innerFns[i](defs.none), i + 1, pushFn);
                if (result) asyncChain = result;
              }
            }
          }
        } catch (error) {
          if (error instanceof defs.Stop) {
            stream.push(null);
            stopped = true;
            callback(null);
            return;
          }
          callback(error);
          return;
        }
        if (asyncChain) {
          asyncChain.then(
            () => (stream.push(null), callback(null)),
            error => {
              if (error instanceof defs.Stop) {
                stopped = true;
                stream.push(null);
                callback(null);
                return;
              }
              callback(error);
            }
          );
          return;
        }
        stream.push(null);
        if (backpressure) {
          pause();
          paused.then(() => callback(null));
        } else {
          callback(null);
        }
        return;
      }
      if (!defs.isFlushable(fn)) {
        stream.push(null);
        callback(null);
        return;
      }
      processChunk(defs.none, null).then(
        () => {
          if (!stopped) stream.push(null);
          callback(null);
        },
        error => callback(error)
      );
    },
    read() {
      resume();
    }
  });

  return stream;
};

export default asStream;
export {asStream};
