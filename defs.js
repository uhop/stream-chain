'use strict';

const none = {};

function Final(value) {
  this.value = value;
}
const final = value => new Final(value);

function Many(values) {
  this.values = values;
}
const many = values => new Many(values);

module.exports.none = none;
module.exports.Final = Final;
module.exports.final = final;
module.exports.Many = Many;
module.exports.many = many;
