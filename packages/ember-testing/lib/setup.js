var testHelpers = {},
    originalMethods = {};

var registerTestHelper = function(name, helperFunction) {
  testHelpers[name] = helperFunction;
};

var unregisterTestHelper = function(name) {
  delete testHelpers[name];
  if (originalMethods[name]) {
    window[name] = originalMethods[name];
  }
  delete originalMethods[name];
};


Ember.Application.reopen({
  pendingAjaxRequests: 0,

  setupForTesting: function() {
    this.deferReadiness();

    this.Router.reopen({
      location: 'none'
    });
  },

  injectTestHelpers: function() {
    var self = this;

    Ember.$(document).ajaxStart(function() {
      self.incrementProperty('pendingAjaxRequests');
    });

    Ember.$(document).ajaxStop(function() {
      self.decrementProperty('pendingAjaxRequests');
    });

    for(var name in testHelpers) {
      originalMethods[name] = window[name];
      window[name] = makeHelperFunction(testHelpers[name]);
    }

    function makeHelperFunction(helperFunction) {
      return function() {
        var unshift = Array.prototype.unshift;
        unshift.call(arguments, self);
        return helperFunction.apply(null, arguments);
      };
    }
  },

  removeTestHelpers: function() {
    for (var name in originalMethods) {
      window[name] = originalMethods[name];
    }
  }
});

Ember.registerTestHelper = registerTestHelper;
Ember.unregisterTestHelper = unregisterTestHelper;
