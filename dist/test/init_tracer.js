'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _url = require('url');

var url = _interopRequireWildcard(_url);

var _chai = require('chai');

var _composite_reporter = require('../src/reporters/composite_reporter');

var _composite_reporter2 = _interopRequireDefault(_composite_reporter);

var _remote_reporter = require('../src/reporters/remote_reporter');

var _remote_reporter2 = _interopRequireDefault(_remote_reporter);

var _const_sampler = require('../src/samplers/const_sampler');

var _const_sampler2 = _interopRequireDefault(_const_sampler);

var _probabilistic_sampler = require('../src/samplers/probabilistic_sampler');

var _probabilistic_sampler2 = _interopRequireDefault(_probabilistic_sampler);

var _remote_sampler = require('../src/samplers/remote_sampler');

var _remote_sampler2 = _interopRequireDefault(_remote_sampler);

var _ratelimiting_sampler = require('../src/samplers/ratelimiting_sampler');

var _ratelimiting_sampler2 = _interopRequireDefault(_ratelimiting_sampler);

var _index = require('../src/index.js');

var _opentracing = require('opentracing');

var _opentracing2 = _interopRequireDefault(_opentracing);

var _remote_throttler = require('../src/throttler/remote_throttler');

var _remote_throttler2 = _interopRequireDefault(_remote_throttler);

var _default_throttler = require('../src/throttler/default_throttler');

var _default_throttler2 = _interopRequireDefault(_default_throttler);

var _http_sender = require('../src/reporters/http_sender.js');

var _http_sender2 = _interopRequireDefault(_http_sender);

var _udp_sender = require('../src/reporters/udp_sender.js');

var _udp_sender2 = _interopRequireDefault(_udp_sender);

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

var logger = {
  info: function info(msg) {},
}; // Copyright (c) 2016 Uber Technologies, Inc.
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

var metrics = {
  createCounter: function createCounter() {
    return {
      increment: function increment() {},
    };
  },
  createGauge: function createGauge() {
    return {};
  },
  createTimer: function createTimer() {
    return {};
  },
};

describe('initTracer', function() {
  it('should initialize noop tracer when disable is set', function() {
    var config = {
      serviceName: 'test-service',
      disable: true,
    };
    var tracer = (0, _index.initTracer)(config);

    (0, _chai.expect)(tracer).to.be.an.instanceof(_opentracing2.default.Tracer);
  });

  it('should throw error on invalid serviceName', function() {
    var configs = [{ serviceName: '' }, { serviceName: null }, {}];

    _lodash2.default.each(configs, function(config) {
      (0, _chai.expect)(function() {
        (0, _index.initTracer)(config);
      }).to.throw('config.serviceName must be provided');
    });
  });

  it('should initialize normal tracer when only service name given', function(done) {
    var config = {
      serviceName: 'test-service',
    };
    var tracer = (0, _index.initTracer)(config);

    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_remote_sampler2.default);
    (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_remote_reporter2.default);
    tracer.close(done);
  });

  it('should initialize proper samplers', function() {
    var config = {
      serviceName: 'test-service',
    };
    var options = [
      { type: 'const', param: 1, expectedType: _const_sampler2.default, expectedParam: 1 },
      { type: 'ratelimiting', param: 2, expectedType: _ratelimiting_sampler2.default, expectedParam: 2 },
      {
        type: 'probabilistic',
        param: 0.5,
        expectedType: _probabilistic_sampler2.default,
        expectedParam: 0.5,
      },
      { type: 'remote', param: 1, expectedType: _remote_sampler2.default, expectedParam: 1 },
    ];

    _lodash2.default.each(options, function(samplerConfig) {
      var expectedType = samplerConfig.expectedType;
      var expectedParam = samplerConfig.expectedParam;
      delete samplerConfig.expectedType;
      delete samplerConfig.expectedParam;

      config.sampler = samplerConfig;
      var tracer = (0, _index.initTracer)(config);

      (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(expectedType);
      tracer.close();
      // TODO(oibe:head) test utils for expectedParam here?
    });
  });

  it('should throw error on sampler incorrect type', function() {
    var config = {
      serviceName: 'test-service',
    };
    var options = [
      { type: 'const', param: 'bad-value' },
      { type: 'ratelimiting', param: 'bad-value' },
      { type: 'probabilistic', param: 'bad-value' },
      { type: 'remote', param: 'bad-value' },
    ];

    var count = 0;
    _lodash2.default.each(options, function(samplerConfig) {
      config.sampler = samplerConfig;

      // Since its an error from a third party framework, its hard to assert on
      // using expect.
      try {
        (0, _index.initTracer)(config);
      } catch (err) {
        count += 1;
      }
    });

    _chai.assert.equal(count, 4);
  });

  describe('reporter options', function() {
    it('should respect reporter options', function(done) {
      var config = {
        serviceName: 'test-service',
        sampler: {
          type: 'const',
          param: 0,
        },
        reporter: {
          logSpans: true,
          agentHost: '127.0.0.1',
          agentPort: 4939,
          flushIntervalMs: 2000,
        },
      };
      var tracer = (0, _index.initTracer)(config);

      (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_composite_reporter2.default);
      var remoteReporter = void 0;
      for (var i = 0; i < tracer._reporter._reporters.length; i++) {
        var reporter = tracer._reporter._reporters[i];
        if (reporter instanceof _remote_reporter2.default) {
          remoteReporter = reporter;
          break;
        }
      }

      _chai.assert.equal(remoteReporter._bufferFlushInterval, 2000);
      _chai.assert.equal(remoteReporter._sender._host, '127.0.0.1');
      _chai.assert.equal(remoteReporter._sender._port, 4939);
      _chai.assert.instanceOf(remoteReporter._sender, _udp_sender2.default);
      tracer.close(done);
    });

    _lodash2.default.each(['http', 'https'], function(protocol) {
      it('should create an HTTPSender if protocol is ' + protocol, function(done) {
        var config = {
          serviceName: 'test-service',
          sampler: {
            type: 'const',
            param: 0,
          },
          reporter: {
            logSpans: true,
            collectorEndpoint: protocol + '://127.0.0.1:4939/my/path',
            username: protocol === 'https' ? 'test' : undefined,
            password: protocol === 'https' ? 'mypass' : undefined,
            flushIntervalMs: 2000,
          },
        };
        var tracer = (0, _index.initTracer)(config);

        (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_composite_reporter2.default);
        var remoteReporter = void 0;
        for (var i = 0; i < tracer._reporter._reporters.length; i++) {
          var reporter = tracer._reporter._reporters[i];
          if (reporter instanceof _remote_reporter2.default) {
            remoteReporter = reporter;
            break;
          }
        }

        _chai.assert.equal(url.format(remoteReporter._sender._url), protocol + '://127.0.0.1:4939/my/path');
        _chai.assert.instanceOf(remoteReporter._sender, _http_sender2.default);
        tracer.close(done);
      });
    });
  });

  it('should pass options to tracer', function(done) {
    var tracer = (0, _index.initTracer)(
      {
        serviceName: 'test-service',
      },
      {
        logger: logger,
        metrics: metrics,
        tags: {
          x: 'y',
        },
        contextKey: 'custom-header',
        baggagePrefix: 'prfx-',
      }
    );
    _chai.assert.equal(tracer._logger, logger);
    _chai.assert.equal(tracer._metrics._factory, metrics);
    _chai.assert.equal(tracer._tags['x'], 'y');

    var textMapInjector = tracer._injectors[_opentracing2.default.FORMAT_TEXT_MAP];
    _chai.assert.equal(textMapInjector._contextKey, 'custom-header');
    _chai.assert.equal(textMapInjector._baggagePrefix, 'prfx-');
    tracer.close(done);
  });

  it('should pass options to remote sampler and reporter', function(done) {
    var logger = {
      info: function info(msg) {},
    };
    var metrics = {
      createCounter: function createCounter() {
        return {
          increment: function increment() {},
        };
      },
      createGauge: function createGauge() {
        return {};
      },
      createTimer: function createTimer() {
        return {};
      },
    };
    var tracer = (0, _index.initTracer)(
      {
        serviceName: 'test-service',
        sampler: {
          type: 'remote',
          param: 0,
        },
      },
      {
        logger: logger,
        metrics: metrics,
      }
    );
    _chai.assert.equal(tracer._reporter._metrics._factory, metrics);
    _chai.assert.equal(tracer._reporter._logger, logger);
    _chai.assert.equal(tracer._sampler._metrics._factory, metrics);
    _chai.assert.equal(tracer._sampler._logger, logger);
    tracer.close(done);
  });

  it('should initialize throttler from config', function() {
    var config = {
      serviceName: 'test-service',
      throttler: {
        refreshIntervalMs: 60000,
      },
    };
    var tracer = (0, _index.initTracer)(config, { logger: logger, metrics: metrics });
    (0, _chai.expect)(tracer._debugThrottler).to.be.an.instanceof(_remote_throttler2.default);
  });

  it('should delegate throttler initialization to tracer', function() {
    var config = {
      serviceName: 'test-service',
    };
    var tracer = (0, _index.initTracer)(config);
    (0, _chai.expect)(tracer._debugThrottler).to.be.an.instanceof(_default_throttler2.default);
  });

  it('should use throttler passed in via options', function() {
    var config = {
      serviceName: 'test-service',
    };
    var throttler = new _remote_throttler2.default();
    var tracer = (0, _index.initTracer)(config, { throttler: throttler });
    (0, _chai.expect)(tracer._debugThrottler).to.equal(throttler);
    throttler.close();
  });
});

describe('initTracerFromENV', function() {
  afterEach(function() {
    delete process.env.JAEGER_SERVICE_NAME;
    delete process.env.JAEGER_DISABLE;
    delete process.env.JAEGER_DISABLED;
    delete process.env.JAEGER_TAGS;
    delete process.env.JAEGER_SAMPLER_TYPE;
    delete process.env.JAEGER_SAMPLER_PARAM;
    delete process.env.JAEGER_SAMPLER_HOST;
    delete process.env.JAEGER_SAMPLER_PORT;
    delete process.env.JAEGER_SAMPLER_MANAGER_HOST_PORT;
    delete process.env.JAEGER_SAMPLER_REFRESH_INTERVAL;
    delete process.env.JAEGER_REPORTER_AGENT_PORT;
    delete process.env.JAEGER_AGENT_PORT;
    delete process.env.JAEGER_REPORTER_AGENT_HOST;
    delete process.env.JAEGER_AGENT_HOST;
    delete process.env.JAEGER_REPORTER_ENDPOINT;
    delete process.env.JAEGER_ENDPOINT;
    delete process.env.JAEGER_REPORTER_USER;
    delete process.env.JAEGER_USER;
    delete process.env.JAEGER_REPORTER_PASSWORD;
    delete process.env.JAEGER_PASSWORD;
    delete process.env.JAEGER_REPORTER_FLUSH_INTERVAL;
    delete process.env.JAEGER_REPORTER_LOG_SPANS;
  });

  it('should initialize noop tracer with mismatching disable env is set', function() {
    process.env.JAEGER_DISABLE = true;

    var tracer = (0, _index.initTracerFromEnv)();

    (0, _chai.expect)(tracer).to.be.an.instanceof(_opentracing2.default.Tracer);
  });

  it('should initialize noop tracer with disable env is set', function() {
    process.env.JAEGER_DISABLED = true;

    var tracer = (0, _index.initTracerFromEnv)();

    (0, _chai.expect)(tracer).to.be.an.instanceof(_opentracing2.default.Tracer);
  });

  it('should initialize tracer from mismatching env', function() {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_DISABLE = false;

    var tracer = (0, _index.initTracerFromEnv)();
    _chai.assert.equal(tracer._serviceName, 'test-service');

    tracer.close();
  });

  it('should initialize tracer from env', function() {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_DISABLED = false;

    var tracer = (0, _index.initTracerFromEnv)();
    _chai.assert.equal(tracer._serviceName, 'test-service');

    tracer.close();
  });

  it('should throw error on no serviceName', function() {
    delete process.env.JAEGER_SERVICE_NAME;
    (0, _chai.expect)(function() {
      (0, _index.initTracerFromEnv)();
    }).to.throw('config.serviceName must be provided');
  });

  it('should parse tags', function() {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_DISABLED = false;
    process.env.JAEGER_TAGS = 'KEY1=${TEST_KEY:VALUE1}, KEY2=VALUE2,KEY3=${TEST_KEY2:VALUE3}';
    process.env.TEST_KEY = 'VALUE4';
    var tracer = (0, _index.initTracerFromEnv)();
    _chai.assert.equal(tracer._tags['KEY1'], 'VALUE4');
    _chai.assert.equal(tracer._tags['KEY2'], 'VALUE2');
    _chai.assert.equal(tracer._tags['KEY3'], 'VALUE3');

    tracer.close();
  });

  it('should initialize proper samplers from env', function() {
    process.env.JAEGER_SERVICE_NAME = 'test-service';

    process.env.JAEGER_SAMPLER_TYPE = 'probabilistic';
    process.env.JAEGER_SAMPLER_PARAM = 0.5;
    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_probabilistic_sampler2.default);
    _chai.assert.equal(tracer._sampler._samplingRate, 0.5);
    tracer.close();

    process.env.JAEGER_SAMPLER_TYPE = 'remote';
    process.env.JAEGER_SAMPLER_MANAGER_HOST_PORT = 'localhost:8080';
    process.env.JAEGER_SAMPLER_REFRESH_INTERVAL = 100;
    tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_remote_sampler2.default);
    _chai.assert.equal(tracer._sampler._host, 'localhost');
    _chai.assert.equal(tracer._sampler._port, 8080);
    _chai.assert.equal(tracer._sampler._refreshInterval, 100);
    tracer.close();
  });

  it('should initialize proper samplers from mismatching env', function() {
    process.env.JAEGER_SERVICE_NAME = 'test-service';

    process.env.JAEGER_SAMPLER_TYPE = 'probabilistic';
    process.env.JAEGER_SAMPLER_PARAM = 0.5;
    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_probabilistic_sampler2.default);
    _chai.assert.equal(tracer._sampler._samplingRate, 0.5);
    tracer.close();

    process.env.JAEGER_SAMPLER_TYPE = 'remote';
    process.env.JAEGER_SAMPLER_HOST = 'localhost';
    process.env.JAEGER_SAMPLER_PORT = 8080;
    process.env.JAEGER_SAMPLER_REFRESH_INTERVAL = 100;
    tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_remote_sampler2.default);
    _chai.assert.equal(tracer._sampler._host, 'localhost');
    _chai.assert.equal(tracer._sampler._port, 8080);
    _chai.assert.equal(tracer._sampler._refreshInterval, 100);
    tracer.close();
  });

  it('should respect udp reporter options from env', function(done) {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_REPORTER_LOG_SPANS = 'true';
    process.env.JAEGER_AGENT_HOST = '127.0.0.1';
    process.env.JAEGER_AGENT_PORT = 4939;
    process.env.JAEGER_REPORTER_FLUSH_INTERVAL = 2000;

    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_composite_reporter2.default);
    var remoteReporter = void 0;
    for (var i = 0; i < tracer._reporter._reporters.length; i++) {
      var reporter = tracer._reporter._reporters[i];
      if (reporter instanceof _remote_reporter2.default) {
        remoteReporter = reporter;
        break;
      }
    }

    _chai.assert.equal(remoteReporter._bufferFlushInterval, 2000);
    _chai.assert.equal(remoteReporter._sender._host, '127.0.0.1');
    _chai.assert.equal(remoteReporter._sender._port, 4939);
    _chai.assert.instanceOf(remoteReporter._sender, _udp_sender2.default);

    tracer.close(done);
  });

  it('should respect udp reporter options from mismatching env', function(done) {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_REPORTER_LOG_SPANS = 'true';
    process.env.JAEGER_REPORTER_AGENT_HOST = '127.0.0.1';
    process.env.JAEGER_REPORTER_AGENT_PORT = 4939;
    process.env.JAEGER_REPORTER_FLUSH_INTERVAL = 2000;

    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_composite_reporter2.default);
    var remoteReporter = void 0;
    for (var i = 0; i < tracer._reporter._reporters.length; i++) {
      var reporter = tracer._reporter._reporters[i];
      if (reporter instanceof _remote_reporter2.default) {
        remoteReporter = reporter;
        break;
      }
    }

    _chai.assert.equal(remoteReporter._bufferFlushInterval, 2000);
    _chai.assert.equal(remoteReporter._sender._host, '127.0.0.1');
    _chai.assert.equal(remoteReporter._sender._port, 4939);
    _chai.assert.instanceOf(remoteReporter._sender, _udp_sender2.default);

    tracer.close(done);
  });

  it('should respect http reporter options from env', function(done) {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_REPORTER_FLUSH_INTERVAL = 3000;
    process.env.JAEGER_ENDPOINT = 'http://127.0.0.1:8080';
    process.env.JAEGER_USER = 'test';
    process.env.JAEGER_PASSWORD = 'xxxx';

    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_remote_reporter2.default);
    _chai.assert.instanceOf(tracer._reporter._sender, _http_sender2.default);
    _chai.assert.equal(tracer._reporter._bufferFlushInterval, 3000);
    _chai.assert.equal(tracer._reporter._sender._url.href, 'http://127.0.0.1:8080/');
    _chai.assert.equal(tracer._reporter._sender._username, 'test');
    _chai.assert.equal(tracer._reporter._sender._password, 'xxxx');

    tracer.close(done);
  });

  it('should respect http reporter options from mismatching env', function(done) {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_REPORTER_FLUSH_INTERVAL = 3000;
    process.env.JAEGER_REPORTER_ENDPOINT = 'http://127.0.0.1:8080';
    process.env.JAEGER_REPORTER_USER = 'test';
    process.env.JAEGER_REPORTER_PASSWORD = 'xxxx';

    var tracer = (0, _index.initTracerFromEnv)();
    (0, _chai.expect)(tracer._reporter).to.be.an.instanceof(_remote_reporter2.default);
    _chai.assert.instanceOf(tracer._reporter._sender, _http_sender2.default);
    _chai.assert.equal(tracer._reporter._bufferFlushInterval, 3000);
    _chai.assert.equal(tracer._reporter._sender._url.href, 'http://127.0.0.1:8080/');
    _chai.assert.equal(tracer._reporter._sender._username, 'test');
    _chai.assert.equal(tracer._reporter._sender._password, 'xxxx');

    tracer.close(done);
  });

  it('should be overridden via direct config setting.', function(done) {
    process.env.JAEGER_SERVICE_NAME = 'test-service';
    process.env.JAEGER_DISABLED = false;
    process.env.JAEGER_SAMPLER_TYPE = 'const';
    process.env.JAEGER_SAMPLER_PARAM = 1;
    process.env.JAEGER_TAGS = 'KEY1=VALUE1';

    var config = {
      serviceName: 'test-service-arg',
      sampler: {
        type: 'remote',
        host: 'localhost',
        port: 8080,
        refreshIntervalMs: 100,
      },
    };
    var options = {
      tags: {
        KEY2: 'VALUE2',
      },
    };
    var tracer = (0, _index.initTracerFromEnv)(config, options);
    _chai.assert.equal(tracer._serviceName, 'test-service-arg');
    (0, _chai.expect)(tracer._sampler).to.be.an.instanceof(_remote_sampler2.default);
    _chai.assert.equal(tracer._sampler._host, 'localhost');
    _chai.assert.equal(tracer._sampler._port, 8080);
    _chai.assert.equal(tracer._sampler._refreshInterval, 100);
    _chai.assert.equal(tracer._tags['KEY2'], 'VALUE2');
    tracer.close(done);
  });
});
//# sourceMappingURL=init_tracer.js.map
