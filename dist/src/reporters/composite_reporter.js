'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _createClass = (function() {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  return function(Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();
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

var _span = require('../span.js');

var _span2 = _interopRequireDefault(_span);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

var CompositeReporter = (function() {
  function CompositeReporter(reporters) {
    _classCallCheck(this, CompositeReporter);

    this._reporters = reporters;
  }

  _createClass(CompositeReporter, [
    {
      key: 'name',
      value: function name() {
        return 'CompositeReporter';
      },
    },
    {
      key: 'report',
      value: function report(span) {
        this._reporters.forEach(function(r) {
          r.report(span);
        });
      },
    },
    {
      key: '_compositeCallback',
      value: function _compositeCallback(limit, callback) {
        var count = 0;
        return function() {
          count++;
          if (count >= limit) {
            callback();
          }
        };
      },
    },
    {
      key: 'close',
      value: function close(callback) {
        var modifiedCallback = callback
          ? this._compositeCallback(this._reporters.length, callback)
          : function() {};
        this._reporters.forEach(function(r) {
          r.close(modifiedCallback);
        });
      },
    },
    {
      key: 'setProcess',
      value: function setProcess(serviceName, tags) {
        this._reporters.forEach(function(r) {
          if (r.setProcess) {
            r.setProcess(serviceName, tags);
          }
        });
      },
    },
  ]);

  return CompositeReporter;
})();

exports.default = CompositeReporter;
//# sourceMappingURL=composite_reporter.js.map
