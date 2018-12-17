'use strict';

const {Writable} = require('stream');

const streamToArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      array.push(chunk);
      callback(null);
    }
  });

const delay = (fn, ms = 20) => async (...args) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn(...args));
      } catch (error) {
        reject(error);
      }
    }, ms);
  });

module.exports = {streamToArray, delay};
