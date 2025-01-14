'use strict';

var _chai = require('chai');

var _metrics = require('../../src/metrics/metrics.js');

var _metrics2 = _interopRequireDefault(_metrics);

var _mock_logger = require('../lib/mock_logger');

var _mock_logger2 = _interopRequireDefault(_mock_logger);

var _config_server = require('../lib/config_server');

var _config_server2 = _interopRequireDefault(_config_server);

var _metric_factory = require('../lib/metrics/local/metric_factory.js');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('../lib/metrics/local/backend.js');

var _backend2 = _interopRequireDefault(_backend);

var _remote_throttler = require('../../src/throttler/remote_throttler');

var _remote_throttler2 = _interopRequireDefault(_remote_throttler);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

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

describe('RemoteThrottler should', function() {
  var server = void 0;
  var logger = void 0;
  var metrics = void 0;
  var throttler = void 0;
  var serviceName = 'service';
  var operation = 'op';
  var other_operation = 'oop';
  var uuid = 'uuid';
  var creditsUpdatedHook = void 0;

  before(function() {
    server = new _config_server2.default().start();
  });

  after(function() {
    server.close();
  });

  beforeEach(function() {
    server.clearConfigs();
    logger = new _mock_logger2.default();
    metrics = new _metrics2.default(new _metric_factory2.default());
    creditsUpdatedHook = _sinon2.default.spy();
    throttler = new _remote_throttler2.default(serviceName, {
      refreshIntervalMs: 0,
      initialDelayMs: 60000,
      metrics: metrics,
      logger: logger,
      onCreditsUpdate: function onCreditsUpdate() {
        return creditsUpdatedHook.apply(undefined, arguments);
      },
    });
  });

  afterEach(function() {
    throttler.close();
  });

  it('return false for isAllowed on initial call and return true once credits are initialized', function(done) {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [{ operation: operation, balance: 3 }]);
    creditsUpdatedHook = function creditsUpdatedHook(_throttler) {
      _chai.assert.isOk(_throttler.isAllowed(operation));
      _chai.assert.equal(_throttler._credits[operation], 2);
      _chai.assert.equal(_backend2.default.counterValue(metrics.throttlerUpdateSuccess), 1);
      _chai.assert.equal(_backend2.default.counterValue(metrics.throttledDebugSpans), 1);
      done();
    };
    _chai.assert.isNotOk(throttler.isAllowed(operation));
    throttler._refreshCredits();
  });

  it('log an error if _refreshCredits is called prior to UUID being set', function() {
    throttler._fetchCredits = _sinon2.default.spy();
    throttler._refreshCredits();
    _chai.assert.equal(logger._errorMsgs.length, 1);
    _sinon2.default.assert.notCalled(throttler._fetchCredits);
  });

  it('not fetch credits if uuid is invalid', function() {
    throttler._fetchCredits = _sinon2.default.spy();
    throttler.setProcess({ uuid: null });
    throttler._refreshCredits();
    _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
    _sinon2.default.assert.notCalled(throttler._fetchCredits);
  });

  it("return false for _isAllowed if operation isn't in _credits or operation has no credits", function() {
    _chai.assert.isNotOk(
      throttler._isAllowed(operation),
      'operation is not set so operation should not be allowed'
    );
    throttler._credits[operation] = 0;
    _chai.assert.isNotOk(throttler._isAllowed(operation), 'operation is set but lacks credit');
    _chai.assert.equal(_backend2.default.counterValue(metrics.throttledDebugSpans), 2);
  });

  it("return false for isAllowed if operation doesn't have enough credits", function() {
    throttler._credits[operation] = 0.5;
    _chai.assert.isNotOk(throttler._isAllowed(operation));
    _chai.assert.equal(_backend2.default.counterValue(metrics.throttledDebugSpans), 1);
  });

  it('succeed when we retrieve credits for multiple operations', function(done) {
    throttler.setProcess({ uuid: uuid });
    server.addCredits(serviceName, [
      { operation: operation, balance: 5 },
      { operation: other_operation, balance: 3 },
    ]);
    throttler._credits[operation] = 0;
    throttler._credits[other_operation] = 0;
    creditsUpdatedHook = function creditsUpdatedHook(_throttler) {
      _chai.assert.isOk(_throttler.isAllowed(operation));
      _chai.assert.equal(_throttler._credits[operation], 4);
      _chai.assert.isOk(_throttler.isAllowed(other_operation));
      _chai.assert.equal(_throttler._credits[other_operation], 2);
      _chai.assert.equal(_backend2.default.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to query for credits', function(done) {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
      done();
    };
    throttler._host = 'Llanfair­pwllgwyngyll­gogery­chwyrn­drobwll­llan­tysilio­gogo­goch';
    throttler._refreshCredits();
  });

  it('emit failure metric on failing to parse bad http json response', function(done) {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
      done();
    };
    server.addCredits(serviceName, 'not-json');
    throttler._refreshCredits();
  });

  it('emit failure metric when server returns an invalid response', function(done) {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    metrics.throttlerUpdateFailure.increment = function() {
      _chai.assert.equal(logger._errorMsgs.length, 1, 'errors=' + logger._errorMsgs);
      done();
    };
    throttler._refreshCredits();
  });

  it('not fetch credits if no operations have been seen', function() {
    throttler = new _remote_throttler2.default(serviceName);
    throttler._fetchCredits = _sinon2.default.spy();
    throttler.setProcess({ uuid: uuid });
    throttler._refreshCredits();
    _sinon2.default.assert.notCalled(throttler._fetchCredits);
    throttler.close();
  });

  it('refresh credits after _afterInitialDelay is called', function(done) {
    throttler.setProcess({ uuid: uuid });
    throttler._credits[operation] = 0;
    server.addCredits(serviceName, [{ operation: operation, balance: 5 }]);
    creditsUpdatedHook = function creditsUpdatedHook(_throttler) {
      _chai.assert.isOk(_throttler.isAllowed(operation));
      _chai.assert.equal(_throttler._credits[operation], 4);
      _chai.assert.equal(_backend2.default.counterValue(metrics.throttlerUpdateSuccess), 1);
      done();
    };
    throttler._afterInitialDelay();
  });
});
//# sourceMappingURL=remote_throttler.js.map
