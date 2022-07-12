'use strict';

import {Readable, Writable} from 'stream';

export const streamToArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      array.push(chunk);
      callback(null);
    }
  });

export const readString = (string, quant) => new Readable({
  read() {
    if (isNaN(quant) || quant < 1) {
      this.push(string);
    } else if (string instanceof Buffer) {
      for (let i = 0; i < string.length; i += quant) {
        this.push(string.slice(i, i + quant));
      }
    } else {
      for (let i = 0; i < string.length; i += quant) {
        this.push(string.substr(i, quant));
      }
    }
    this.push(null);
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
