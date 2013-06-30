var slice = [].slice,
    helpers = {},
    originalMethods = {},
    injectHelpersCallbacks = [];

/**
  @class Test
  @namespace Ember
*/
Ember.Test = {

  /**
    @public

    `registerHelper` is used to register a
    test helper that will be injected when
    `App.injectTestHelpers` is called.

    The helper method will always be called
    with the current Application as the first
    parameter.

    For example:
    ```javascript
    Ember.Test.registerHelper('boot', function(app)) {
      Ember.run(app, app.advanceReadiness);
    }
    ```

    This helper can later be called without arguments
    because it will be called with `app` as the
    first parameter.

    ```javascript
      App = Ember.Application.create();
      App.injectTestHelpers();
      boot();
    ```
    Whenever you register a helper that
    performs async operations,
    make sure you `return wait();` at the
    end of the helper.

    If an async helper also needs to return a value,
    pass it to the `wait` helper as a first argument:
    `return wait(val);`

    If a helper is not async and needs to return
    a value immediately (such as `find`), pass
    `{ wait: true }` as an option parameter.

    @method registerHelper
    @param name {String}
    @param helperMethod {Function}
    @param options {Object}
  */
  registerHelper: function(name, helperMethod, meta) {
    meta = meta || {};
    if (meta.wait === undefined) {
      meta.wait = true;
    }
    helpers[name] = {
      method: helperMethod,
      meta: meta
    };
  },
  /**
    @public
    @method unregisterHelper
    @param name {String}
  */
  unregisterHelper: function(name) {
    delete helpers[name];
    if (originalMethods[name]) {
      window[name] = originalMethods[name];
    }
    delete originalMethods[name];
    delete Ember.Test.Promise.prototype[name];
  },

  /**
    @public

    Used to register callbacks to be fired
    whenever `App.injectTestHelpers` is called

    The callback will receive the current application
    as an argument.

    @method unregisterHelper
    @param name {String}
  */
  onInjectHelpers: function(callback) {
    injectHelpersCallbacks.push(callback);
  },

  /**
    @public

    This returns a thenable tailored
    for testing.  It catches failed
    `onSuccess` callbacks and invokes
    the `Ember.Test.adapter.exception`
    callback in the last chained then.

    This method should be returned
    by async helpers such as `wait`.

    @method promise
    @param resolver {Function}
  */
  promise: function(resolver) {
    return new Ember.Test.Promise(resolver);
  },

  lastPromise: null,

  /**
   @public

   Used to allow ember-testing
   to communicate with a specific
   testing framework.

   You can manually set it before calling
   `App.setupForTesting()`.

   Example:
   'Ember.Test.adapter = MyCustomAdapter.create()'

   If you do not set it, ember-testing
   will default to `Ember.Test.QUnitAdapter`.
  */
  adapter: null
};

function curry(app, fn, meta) {
  return function() {
    var args = slice.call(arguments),
        wait = app.testHelpers.wait,
        lastPromise = Ember.Test.lastPromise;

    args.unshift(app);

    // some helpers are not async and
    // need to return a value immediately.
    // example: `find`
    if (!meta.wait) {
      return fn.apply(app, args);
    }

    if (!lastPromise) {
      // It's the first async helper in current context
      lastPromise = applyHelperMethod(fn, app, args);
    } else {
      // wait for last helper's promise to resolve
      // and then execute
      run(function() {
        lastPromise = lastPromise.then(function() {
          return applyHelperMethod(fn, app, args);
        });
      });
    }

    // If return value is not thenable
    // wrap the value in `wait`
    if (!lastPromise.then) {
      lastPromise = wait(lastPromise);
    }

    Ember.Test.lastPromise = lastPromise;
    return lastPromise;
  };
}

function run(fn) {
  if (!Ember.run.currentRunLoop) {
    Ember.run(fn);
  } else {
    fn();
  }
}

// This method isolates nested helpers
// so that they don't conflict with other last promises
function applyHelperMethod(fn, app, args) {
  var value, lastPromise,
      prevPromise = Ember.Test.lastPromise;

  // reset lastPromise for nested helpers
  Ember.Test.lastPromise = null;
  value = fn.apply(app, args);
  lastPromise = Ember.Test.lastPromise;

  // If the helper returned a promise
  // return that promise. If not,
  // return the last async helper's promise
  if ((value && value.then) || !lastPromise) {
    return value;
  } else {
    run(function() {
      lastPromise = lastPromise.then(function() {
        return value;
      });
    });
    return lastPromise;
  }

  Ember.Test.lastPromise = prevPromise;
}

Ember.Application.reopen({
  testHelpers: {},

  setupForTesting: function() {
    this.deferReadiness();

    this.Router.reopen({
      location: 'none'
    });

    // if adapter is not manually set
    // default to QUnit
    if (!Ember.Test.adapter) {
       Ember.Test.adapter = Ember.Test.QUnitAdapter.create();
    }
  },

  injectTestHelpers: function() {
    this.testHelpers = {};
    for (var name in helpers) {
      originalMethods[name] = window[name];
      this.testHelpers[name] = window[name] = curry(this, helpers[name].method, helpers[name].meta);
      protoWrap(Ember.Test.Promise.prototype, name, curry(this, helpers[name].method, helpers[name].meta));
    }

    for(var i = 0, l = injectHelpersCallbacks.length; i < l; i++) {
      injectHelpersCallbacks[i](this);
    }

    Ember.RSVP.configure('onerror', onerror);
  },

  removeTestHelpers: function() {
    for (var name in helpers) {
      window[name] = originalMethods[name];
      delete this.testHelpers[name];
      delete originalMethods[name];
    }
    Ember.RSVP.configure('onerror', null);
  }

});

// This method is no longer needed
// But still here for backwards compatibility
function protoWrap(proto, name, callback) {
  proto[name] = function() {
    var args = arguments;
    return callback.apply(this, args);
  };
}

Ember.Test.Promise = function() {
  Ember.RSVP.Promise.apply(this, arguments);
};

Ember.Test.Promise.prototype = Ember.create(Ember.RSVP.Promise.prototype);
Ember.Test.Promise.prototype.constructor = Ember.Test.Promise;


function onerror(error) {
  Ember.Test.adapter.exception(error);
}
