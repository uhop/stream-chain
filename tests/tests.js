'use strict';

const unit = require('heya-unit');

require('./test_FromIterable');

require('./test_simple');
require('./test_readWrite');
require('./test_errors');

require('./test_transducers');
// require('./test_comp');
require('./test_gen');

require('./test_take');
require('./test_skip');
require('./test_fold');

require('./test_demo');

unit.run();
