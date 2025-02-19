'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _mock_logger = require('./lib/mock_logger');

var _mock_logger2 = _interopRequireDefault(_mock_logger);

var _remote_reporter = require('../src/reporters/remote_reporter');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _tracer = require('../src/tracer');

var _tracer2 = _interopRequireDefault(_tracer);

var _udp_sender = require('../src/reporters/udp_sender');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

var _metrics = require('../src/metrics/metrics');

var _metrics2 = _interopRequireDefault(_metrics);

var _metric_factory = require('./lib/metrics/local/metric_factory');

var _metric_factory2 = _interopRequireDefault(_metric_factory);

var _backend = require('./lib/metrics/local/backend');

var _backend2 = _interopRequireDefault(_backend);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

describe('Remote Reporter', function() {
  var tracer = void 0;
  var reporter = void 0;
  var sender = void 0;
  var logger = void 0;
  var metrics = void 0;

  beforeEach(function() {
    try {
      metrics = new _metrics2.default(new _metric_factory2.default());
      sender = new _udp_sender2.default();
      logger = new _mock_logger2.default();
      reporter = new _remote_reporter2.default(sender, {
        logger: logger,
        metrics: metrics,
      });
      tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true));
    } catch (e) {
      // this is useful to catch errors when thrift definition is changed
      console.log('beforeEach failed', e);
      console.log(e.stack);
    }
  });

  afterEach(function() {
    logger.clear();
    var callback = function callback() {}; // added for coverage reasons
    reporter.close(callback);
  });

  it('should report span, and flush', function(done) {
    var span = tracer.startSpan('operation-name');

    // add duration to span, and report it
    span.finish();
    _chai.assert.equal(sender._batch.spans.length, 1);

    reporter.flush(function() {
      _chai.assert.equal(sender._batch.spans.length, 0);
      _chai.assert.isOk(_backend2.default.counterEquals(metrics.reporterSuccess, 1));
      done();
    });
  });

  it('should have coverage for simple code paths', function() {
    var sender = new _udp_sender2.default();
    sender.setProcess({
      serviceName: 'service-name',
      tags: [],
    });
    var reporter = new _remote_reporter2.default(sender);

    _chai.assert.equal(reporter.name(), 'RemoteReporter');

    reporter.close();
  });

  it('should throw exception when initialized without a sender', function() {
    (0, _chai.expect)(function() {
      new _remote_reporter2.default();
    }).to.throw('RemoteReporter must be given a Sender.');
  });

  it('should fail to flush spans with bad sender', function(done) {
    var mockSender = {
      flush: function flush(callback) {
        callback(1, 'mock error');
      },
      close: function close() {},
    };

    reporter._sender = mockSender;
    reporter.flush(function() {
      (0, _chai.expect)(logger._errorMsgs[0]).to.have.string('Failed to flush spans in reporter');
      _chai.assert.isOk(_backend2.default.counterEquals(metrics.reporterFailure, 1));
      done();
    });
  });

  it('should not flush if process is not set', function(done) {
    reporter = new _remote_reporter2.default(sender, {
      logger: logger,
    });
    reporter.flush(function() {
      (0, _chai.expect)(logger._errorMsgs[0]).to.have.string('Failed to flush since process is not set');
      done();
    });
  });
}); // Copyright (c) 2016 Uber Technologies, Inc.
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
//# sourceMappingURL=remote_reporter.js.map
