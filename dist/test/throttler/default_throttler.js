'use strict';

var _chai = require('chai');

var _default_throttler = require('../../src/throttler/default_throttler');

var _default_throttler2 = _interopRequireDefault(_default_throttler);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// Copyright (c) 2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

describe('DefaultThrottler should', function() {
  it('throttle everything', function() {
    var throttler = new _default_throttler2.default(true);
    throttler.setProcess({});
    _chai.assert.isNotOk(throttler.isAllowed('key'));
    throttler.close();
  });

  it('throttle nothing', function(done) {
    var throttler = new _default_throttler2.default();
    throttler.setProcess({});
    _chai.assert.isOk(throttler.isAllowed('key'));
    throttler.close(done);
  });
});
//# sourceMappingURL=default_throttler.js.map
