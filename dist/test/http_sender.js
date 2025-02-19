'use strict';

var _slicedToArray = (function() {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;
    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);
        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i['return']) _i['return']();
      } finally {
        if (_d) throw _e;
      }
    }
    return _arr;
  }
  return function(arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError('Invalid attempt to destructure non-iterable instance');
    }
  };
})(); // Copyright (c) 2018 Uber Technologies, Inc.
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

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _url = require('url');

var URL = _interopRequireWildcard(_url);

var _bodyParser = require('body-parser');

var _chai = require('chai');

var _const_sampler = require('../src/samplers/const_sampler.js');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

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

var _http_sender = require('../src/reporters/http_sender.js');

var _http_sender2 = _interopRequireDefault(_http_sender);

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};
    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }
    newObj.default = obj;
    return newObj;
  }
}

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var batchSize = 100;

describe('http sender', function() {
  var app = void 0;
  var server = void 0;
  var tracer = void 0;
  var thrift = void 0;
  var serverEndpoint = void 0;
  var reporter = void 0;
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
    thrift = new _thriftrw.Thrift({
      source: _fs2.default.readFileSync(
        _path2.default.join(__dirname, '../src/jaeger-idl/thrift/jaeger.thrift'),
        'ascii'
      ),
      allowOptionalArguments: true,
    });

    app = (0, _express2.default)();
    app.use((0, _bodyParser.raw)({ type: 'application/x-thrift' }));
    app.post('/api/traces', function(req, res) {
      if (req.headers.authorization) {
        var b64auth = (req.headers.authorization || '').split(' ')[1] || '';

        var _toString$split = new Buffer(b64auth, 'base64').toString().split(':'),
          _toString$split2 = _slicedToArray(_toString$split, 2),
          username = _toString$split2[0],
          password = _toString$split2[1];

        server.emit('authReceived', [username, password]);
      }
      var thriftObj = thrift.Batch.rw.readFrom(req.body, 0);
      var batch = thriftObj.value;
      if (batch) {
        server.emit('batchReceived', batch);
      }
      res.status(202).send('');
    });
    server = app.listen(0);
    serverEndpoint = 'http://localhost:' + server.address().port + '/api/traces';

    reporter = new _in_memory_reporter2.default();
    tracer = new _tracer2.default('test-service-name', reporter, new _const_sampler2.default(true));
    sender = new _http_sender2.default({
      endpoint: serverEndpoint,
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);
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

    server.on('batchReceived', function(batch) {
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
    });

    sender.append(spanOne, assertCallback(0, undefined));
    sender.append(spanTwo, assertCallback(0, undefined));
    sender.flush(function(numSpans, error) {
      assertCallback(2, undefined)(numSpans, error);
      done();
    });
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
        childOf: parentContext,
        references: [childOfRef, followsFromRef],
        expectedTraceId: parentContext.traceId,
        expectedParentId: parentContext.parentId,
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

        server.on('batchReceived', function(batch) {
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

          done();
        });

        sender.append(tSpan);
        sender.flush();
      });
    });
  });

  it('should flush spans when capacity is reached', function(done) {
    var spans = [];
    for (var i = 0; i < batchSize; i++) {
      var s = tracer.startSpan('operation-' + i);
      s.finish();
      spans.push(_thrift2.default.spanToThrift(s));
    }

    for (var _i = 0; _i < batchSize - 1; _i++) {
      sender.append(spans[_i], assertCallback(0, undefined));
    }

    sender.append(spans[batchSize - 1], assertCallback(batchSize, undefined));

    server.on('batchReceived', function(batch) {
      done();
    });
  });

  it('should use basic auth if username/password provided', function(done) {
    sender = new _http_sender2.default({
      endpoint: serverEndpoint,
      username: 'me',
      password: 's3cr3t',
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    var s = tracer.startSpan('operation-one');
    s.finish();
    sender.append(_thrift2.default.spanToThrift(s), assertCallback(0, undefined));
    sender.flush();

    server.on('authReceived', function(creds) {
      (0, _chai.expect)(creds[0]).to.equal('me');
      (0, _chai.expect)(creds[1]).to.equal('s3cr3t');
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
      (0, _chai.expect)(err).to.have.string('Error encoding Thrift batch:');
      done();
    });
  });

  it('should return 0,undefined on flush() with no spans', function() {
    sender.flush(assertCallback(0, undefined));
  });

  it('should gracefully handle errors emitted by socket.send', function(done) {
    sender = new _http_sender2.default({
      endpoint: 'http://foo.bar.xyz',
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    var tracer = new _tracer2.default(
      'test-service-name',
      new _remote_reporter2.default(sender),
      new _const_sampler2.default(true)
    );

    tracer.startSpan('testSpan').finish();
    sender.flush(function(numSpans, err) {
      _chai.assert.equal(numSpans, 1);
      (0, _chai.expect)(err).to.have.string('error sending spans over HTTP: Error: getaddrinfo ENOTFOUND');
      tracer.close(done);
    });
  }).timeout(5000);

  it('should handle HTTPS collectors', function(done) {
    // Make it ignore the fact that our cert isn't valid.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    var options = {
      key:
        '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDmnEKeVkNNQylt\nI+HgcxBzY3w9oCMvg/SBn0jy5d9XYeQNreP+VujBNEo+OmmAzYeh7Nv3lq78zH31\nRzznwF/4lYBE148SOhT+KP0NvAt4uiVf3zjD2zChSdpSWoR9CZOxwJM06YrIvJlX\nxkm3fcWzcZ6r/DrhDgC44QXlD1qqcFZ5ITkGRWF+ym5sh+FRr1qhRcFURFMH67G2\niZ+CLUzBPAYJ8Ho9HNkm8R0IN/yLAymnjXLW7QjrZ+w88IVyv38Lm9RFFjQ21WRq\nSdCMw0/ZL+Fcmjstj3PvcO5jPFNwijuKMvkpP1fspH9wLNg6NzChkwTNUlqsekek\nOlvihWRvAgMBAAECggEAUZcJjuGwUB6qAn5GhVXQhTK2m0sUB9Sk5lOHyMCBw3XT\n7O8QEkWHdgvdFKUv/K07BpQ5wyBh6vkiu2wn5UrP6bBjQHgPm4BHOyEfXwOf/2fE\nn2XnvIvJadcqUibKZz7DLYmXy4mxW5I2orJ6FFyAXRue6vSDlGqS4NZkcoV7K3+F\nWtBDGl1FVEqQXy1iCmbm0izqlFAf3xV1piS+hd0XgM1+3F8mcmICP+oWDJLeItXO\nEjklysZdcZ6o40Vr7Sxp2XhC/BO7r6MsYCP1PDPl6fQnkIS7mf1qjHZo+ryRVhB4\nRY1SSGT5xRc4v2pBcxSwELEJRiJMj/WcrveneGJZeQKBgQD8Wro1S50Dis8Qf9+o\nYU+jSsRwJmoAguZNNOXXdovN7LMOqykOXl13vXZ+gth6R2UlbU7EVNLe+dAxnHKv\njBPEvQPm3dh4V9O4NNqJ5pfi85MjIc9PIZV5h7pQo77RMPv0o4Fe36Yo0fb1KD0o\nh5SCTD7F42qyQ1YqTVZDlskVNQKBgQDp8R4oegKsCZnIOhO2Q5O3Gu6+b18VmEtf\nDoOtyLTg+M27Ngnur2OdUc3YHOVpzSEi9BFkhonv6gSEplycq7LnaNBXFLF0KGrh\nC8ChaaSpY/BZLZLeBGQu9cYq6ZI+CwbClBeLAqXvJRbes7RHKTjG+6Ixea5krGB3\ng2GUDN87kwKBgQCbO0w0IJEzbp21LpPsRf/xGLsBqf+m1N7KO3HvOnMBd0smCM+2\nkQG5+If9houXnHdxsG21g+A7XTxeaDh8GBTI/uR5jZntXUlVlN2h2oEwEFlAUTnv\nGV+TZJSNqkxk7lbuw+1+6OCTV6UsZVZJqi0GgdRTcnNduOI2H2CjLwv+yQKBgQCU\nPEOm1EETL/YwyJQq/sD/2mIDa2Ctt1WzAuhvWuk6UI1UHhbHFn2hdu9fDFhV5TQl\nCNBoiVOoIPoB78RpRebT+TdipmsXNnEa7q592QoMh5YJe/Y/FjtBAl0yXdRb2fLL\norkUTXZFhZPrQ6VtHfKrK1GH1hmqEwwBTs+q10kwXwKBgQDXfm6ee3Vc7p6s7x+h\n4kf0VBZYqVVUC2N7l8BdHXc/AOAb5aRCdg0UHdA5zMghtGmk5pvburrXxNR6rJHo\nVNbvxeM87eQSDZUT8oO30kcKJKr3rHvDxN0NGghFEdvDNDIo4BFBUjwYATudRQDM\n3AahfvL8vW4xXANRuPmVz43TBA==\n-----END PRIVATE KEY-----',
      cert:
        '-----BEGIN CERTIFICATE-----\nMIIDpTCCAo2gAwIBAgIJAOOgmfOEDemYMA0GCSqGSIb3DQEBCwUAMGkxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEPMA0G\nA1UECgwGSmFlZ2VyMRAwDgYDVQQLDAdUcmFjaW5nMRIwEAYDVQQDDAlsb2NhbGhv\nc3QwHhcNMTgwODE2MTg0MjA0WhcNNDYwMTAxMTg0MjA0WjBpMQswCQYDVQQGEwJV\nUzELMAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDzANBgNVBAoM\nBkphZWdlcjEQMA4GA1UECwwHVHJhY2luZzESMBAGA1UEAwwJbG9jYWxob3N0MIIB\nIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5pxCnlZDTUMpbSPh4HMQc2N8\nPaAjL4P0gZ9I8uXfV2HkDa3j/lbowTRKPjppgM2Hoezb95au/Mx99Uc858Bf+JWA\nRNePEjoU/ij9DbwLeLolX984w9swoUnaUlqEfQmTscCTNOmKyLyZV8ZJt33Fs3Ge\nq/w64Q4AuOEF5Q9aqnBWeSE5BkVhfspubIfhUa9aoUXBVERTB+uxtomfgi1MwTwG\nCfB6PRzZJvEdCDf8iwMpp41y1u0I62fsPPCFcr9/C5vURRY0NtVkaknQjMNP2S/h\nXJo7LY9z73DuYzxTcIo7ijL5KT9X7KR/cCzYOjcwoZMEzVJarHpHpDpb4oVkbwID\nAQABo1AwTjAdBgNVHQ4EFgQUz2dnzTaJoc995597JxRu5jQRno0wHwYDVR0jBBgw\nFoAUz2dnzTaJoc995597JxRu5jQRno0wDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0B\nAQsFAAOCAQEAPTpTJnhIwtbxa/yDn7BvkV6DDU/Y+fyXuR/wEb/aFfsWfJbK+7qe\nFChX4hxiAOMUEEGhyredunCG3cgz46l+Lb+vQZafzr0JZCBNa6IKRUVWkHps2TRV\nwtcXSFAly4tcRyYGtVr+qGFd9oHWBRSBU0bzv3Rb/AVbXCpSTcjZwqPRvzqyICYf\nkZ7z6b0kLxSume4h6beQnCH/tWdxbZqZbsEINxO5o6JHhslpiGNjm5BulT6dr91k\n8O6L8TprggQz6H5l8N5dCxbYARTsHBf1tqcmyxV/hAjoJFU9kvmU+r+QJMRWCyOe\nCk6tc1MJHquCkX3Xum+KKegTn18rot6XvQ==\n-----END CERTIFICATE-----',
    };

    server = _https2.default.createServer(options, app).listen(0);
    serverEndpoint = 'https://localhost:' + server.address().port + '/api/traces';
    sender = new _http_sender2.default({
      endpoint: serverEndpoint,
      maxSpanBatchSize: batchSize,
    });
    sender.setProcess(reporter._process);

    var s = tracer.startSpan('operation');
    s.finish();
    sender.append(_thrift2.default.spanToThrift(s));
    sender.flush();

    server.on('batchReceived', function(batch) {
      done();
    });
  });
});
//# sourceMappingURL=http_sender.js.map
