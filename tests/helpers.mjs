'use strict';

import {Writable} from 'stream';

export const streamToArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      array.push(chunk);
      callback(null);
    }
  });

export const delay = (fn, ms = 20) => async (...args) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn(...args));
      } catch (error) {
        reject(error);
      }
    }, ms);
  });
