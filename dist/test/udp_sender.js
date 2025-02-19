'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _dgram = require('dgram');

var _dgram2 = _interopRequireDefault(_dgram);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _semver = require('semver');

var _semver2 = _interopRequireDefault(_semver);

var _in_memory_reporter = require('../src/reporters/in_memory_reporter.js');

var _in_memory_reporter2 = _interopRequireDefault(_in_memory_reporter);

var _remote_reporter = require('../src/reporters/remote_reporter.js');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _tracer = require('../src/tracer.js');

var _tracer2 = _interopRequireDefault(_tracer);

var _thriftrw = require('thriftrw');

var _thrift = require('../src/thrift.js');

var _thrift2 = _interopRequireDefault(_thrift);

var _udp_sender = require('../src/reporters/udp_sender.js');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// Copyright (c) 2016 Uber Technologies, Inc.
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

var PORT = 6832;
var HOST = '127.0.0.1';

describe('udp sender', function() {
  var server = void 0;
  var tracer = void 0;
  var thrift = void 0;
  var sender = void 0;

  function assertThriftSpanEqual(assert, spanOne, spanTwo) {
    assert.deepEqual(spanOne.traceIdLow, spanTwo.traceIdLow);
    assert.deepEqual(spanOne.traceIdHigh, spanTwo.traceIdHigh);
    assert.deepEqual(spanOne.spanId, spanTwo.spanId);
    assert.deepEqual(spanOne.parentSpanId, spanTwo.parentSpanId);
    assert.equal(spanOne.operationName, spanTwo.operationName);
    assert.deepEqual(spanOne.references, spanTwo.references);
    assert.equal(spanOne.flags, spanTwo.flags);
    assert.deepEqual(spanOne.startTime, spanTwo.startTime);
    assert.deepEqual(spanOne.duration, spanTwo.duration);
  }

  beforeEach(function() {
    server = _dgram2.default.createSocket('udp4');
    server.bind(PORT, HOST);
    var reporter = new _in_memory_reporter2.default();
    tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true));
    sender = new _udp_sender2.default();
    sender.setProcess(reporter._process);
    thrift = new _thriftrw.Thrift({
      entryPoint: _path2.default.join(__dirname, '../src/thriftrw-idl/agent.thrift'),
      allowOptionalArguments: true,
      allowFilesystemAccess: true,
    });
  });

  afterEach(function() {
    tracer.close();
    server.close();
  });

  function assertCallback(expectedNumSpans, expectedError) {
    return function(numSpans, error) {
      _chai.assert.equal(numSpans, expectedNumSpans);
      _chai.assert.equal(error, expectedError);
    };
  }

  it('should read and verify spans and process sent', function(done) {
    var spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = _thrift2.default.spanToThrift(spanOne);
    var spanTwo = tracer.startSpan('operation-two');
    spanTwo.finish(); // finish to set span duration
    spanTwo = _thrift2.default.spanToThrift(spanTwo);

    // make sure sender can fit both spans
    var maxSpanBytes = sender._calcSpanSize(spanOne).length + sender._calcSpanSize(spanTwo).length + 30;
    sender._maxSpanBytes = maxSpanBytes;

    server.on('message', function(msg, remote) {
      var thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
      var batch = thriftObj.value.body.batch;
      _chai.assert.isOk(batch);
      _chai.assert.equal(batch.spans.length, 2);

      assertThriftSpanEqual(_chai.assert, spanOne, batch.spans[0]);
      assertThriftSpanEqual(_chai.assert, spanTwo, batch.spans[1]);

      _chai.assert.equal(batch.process.serviceName, 'test-service-name');
      var actualTags = _lodash2.default.sortBy(batch.process.tags, function(o) {
        return o.key;
      });
      _chai.assert.equal(actualTags.length, 4);
      _chai.assert.equal(actualTags[0].key, 'client-uuid');
      _chai.assert.equal(actualTags[1].key, 'hostname');
      _chai.assert.equal(actualTags[2].key, 'ip');
      _chai.assert.equal(actualTags[3].key, 'jaeger.version');

      sender.close();
      done();
    });

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanTwo, assertCallback(0, undefined));
    sender.flush(assertCallback(2, undefined));
  });

  describe('span reference tests', function() {
    var tracer = new _tracer2.default(
      'test-service-name',
      new _in_memory_reporter2.default(),
      new _const_sampler2.default(true)
    );
    var parentContext = tracer.startSpan('just-used-for-context').context();
    var childOfContext = tracer.startSpan('just-used-for-context').context();
    var childOfRef = new _opentracing2.default.Reference(
      _opentracing2.default.REFERENCE_CHILD_OF,
      childOfContext
    );
    var followsFromContext = tracer.startSpan('just-used-for-context').context();
    var followsFromRef = new _opentracing2.default.Reference(
      _opentracing2.default.REFERENCE_FOLLOWS_FROM,
      followsFromContext
    );

    var options = [
      { childOf: null, references: [], expectedTraceId: null, expectedParentId: null },
      {
        childOf: null,
        references: [childOfRef, followsFromRef],
        expectedTraceId: childOfContext.traceId,
        expectedParentId: childOfContext.parentId,
      },
    ];

    _lodash2.default.each(options, function(o) {
      it('should serialize span references', function(done) {
        var span = tracer.startSpan('bender', {
          childOf: o.childOf,
          references: o.references,
        });
        span.finish();
        var tSpan = _thrift2.default.spanToThrift(span);

        server.on('message', function(msg, remote) {
          var thriftObj = thrift.Agent.emitBatch.argumentsMessageRW.readFrom(msg, 0);
          var batch = thriftObj.value.body.batch;

          _chai.assert.isOk(batch);
          assertThriftSpanEqual(_chai.assert, tSpan, batch.spans[0]);
          if (o.expectedTraceId) {
            _chai.assert.deepEqual(batch.spans[0].traceIdLow, o.expectedTraceId);
          }

          if (o.expectedParentId) {
            _chai.assert.deepEqual(batch.spans[0].parentId, o.expectedParentId);
          } else {
            _chai.assert.isNotOk(batch.spans[0].parentId);
          }

          sender.close();
          done();
        });

        sender.append(tSpan);
        sender.flush();
      });
    });
  });

  it('should flush spans when capacity is reached', function() {
    var spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = _thrift2.default.spanToThrift(spanOne);
    var spanSize = sender._calcSpanSize(spanOne).length;
    sender._maxSpanBytes = spanSize * 2;

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanOne, assertCallback(2, undefined));

    _chai.assert.equal(sender._batch.spans.length, 0);
    _chai.assert.equal(sender._totalSpanBytes, 0);
  });

  it('should flush spans when just over capacity', function(done) {
    var spanOne = tracer.startSpan('operation-one');
    spanOne.finish(); // finish to set span duration
    spanOne = _thrift2.default.spanToThrift(spanOne);
    var spanSize = sender._calcSpanSize(spanOne).length;
    sender._maxSpanBytes = spanSize * 2;

    var spanThatExceedsCapacity = tracer.startSpan('bigger-span');
    spanThatExceedsCapacity.setTag('some-key', 'some-value');
    spanThatExceedsCapacity.finish(); // finish to set span duration
    spanThatExceedsCapacity = _thrift2.default.spanToThrift(spanThatExceedsCapacity);
    var largeSpanSize = sender._calcSpanSize(spanThatExceedsCapacity).length;

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanThatExceedsCapacity, function(numSpans, error) {
      _chai.assert.equal(numSpans, 1);
      _chai.assert.equal(error, undefined);

      _chai.assert.equal(sender._batch.spans.length, 1);
      _chai.assert.equal(sender._totalSpanBytes, largeSpanSize);
      done();
    });
  });

  it('should returns error from flush() on failed buffer conversion', function(done) {
    var span = tracer.startSpan('leela');
    span.finish(); // finish to set span duration
    span = _thrift2.default.spanToThrift(span);
    span.flags = 'string'; // malform the span to create a serialization error
    sender.append(span);
    sender.flush(function(numSpans, err) {
      _chai.assert.equal(numSpans, 1);
      (0, _chai.expect)(err).to.have.string('error writing Thrift object:');
      done();
    });
  });

  it('should return error upon thrift conversion failure', function(done) {
    sender._logger = {
      error: function error(msg) {
        (0, _chai.expect)(msg).to.have.string('error converting span to Thrift:');
        done();
      },
    };
    var span = tracer.startSpan(undefined);
    span.finish();

    sender.append(_thrift2.default.spanToThrift(span), function(numSpans, err) {
      _chai.assert.equal(numSpans, 1);
      (0, _chai.expect)(err).to.have.string('error converting span to Thrift:');
      done();
    });
  });

  it('should return error on span too large', function(done) {
    var span = tracer.startSpan('op-name');
    span.finish(); // otherwise duration will be undefined

    sender._maxSpanBytes = 1;
    sender.append(_thrift2.default.spanToThrift(span), function(numSpans, err) {
      _chai.assert.equal(numSpans, 1);
      (0, _chai.expect)(err).to.have.string('is larger than maxSpanSize');
      done();
    });
  });

  it('should return 0,undefined on flush() with no spans', function() {
    sender.flush(assertCallback(0, undefined));
  });

  it('should gracefully handle errors emitted by socket.send', function(done) {
    var tracer = new _tracer2.default(
      'test-service-name',
      new _remote_reporter2.default(sender),
      new _const_sampler2.default(true)
    );
    sender._host = 'foo.bar.xyz';
    // In Node 0.10 and 0.12 the error is logged twice: (1) from inline callback, (2) from on('error') handler.
    var expectLogs = _semver2.default.satisfies(process.version, '0.10.x || 0.12.x');
    sender._logger = {
      info: function info(msg) {
        console.log('sender info: ' + msg);
      },
      error: function error(msg) {
        _chai.assert.isOk(expectLogs);
        (0, _chai.expect)(msg).to.have.string('error sending spans over UDP: Error: getaddrinfo ENOTFOUND');
        tracer.close(done);
      },
    };
    tracer.startSpan('testSpan').finish();
    sender.flush(function(numSpans, err) {
      _chai.assert.equal(numSpans, 1);
      (0, _chai.expect)(err).to.have.string('error sending spans over UDP: Error: getaddrinfo ENOTFOUND');
      if (!expectLogs) {
        tracer.close(done);
      }
    });
  }).timeout(5000);
});
//# sourceMappingURL=udp_sender.js.map
