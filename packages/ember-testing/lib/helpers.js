require('ember-testing/test');

var get = Ember.get,
    Test = Ember.Test,
    helper = Test.registerHelper,
    countAsync = 0;

Test.pendingAjaxRequests = 0;

Test.onInjectHelpers(function() {
  Ember.$(document).ajaxStart(function() {
    Test.pendingAjaxRequests++;
  });

  Ember.$(document).ajaxStop(function() {
    Test.pendingAjaxRequests--;
  });
});


function visit(app, url) {
  app.__container__.lookup('router:main').location.setURL(url);
  Ember.run(app, app.handleURL, url);
  return wait(app);
}

function click(app, selector, context) {
  var $el = findWithAssert(app, selector, context);
  Ember.run($el, 'click');
  return wait(app);
}

function fillIn(app, selector, context, text) {
  var $el;
  if (typeof text === 'undefined') {
    text = context;
    context = null;
  }
  $el = findWithAssert(app, selector, context);
  Ember.run(function() {
    $el.val(text).change();
  });
  return wait(app);
}

function findWithAssert(app, selector, context) {
  var $el = find(app, selector, context);
  if ($el.length === 0) {
    throw("Element " + selector + " not found.");
  }
  return $el;
}

function find(app, selector, context) {
  var $el;
  context = context || get(app, 'rootElement');
  $el = app.$(selector, context);

  return $el;
}

function andThen(app, callback) {
  return wait(app, callback(app));
}

function wait(app, value) {
  var p = Test.promise(function(resolve) {
    // If this is the first async promise, kick off the async test
    if (++countAsync === 1) {
      Test.adapter.asyncStart();
    }

    // Every 10ms, poll for the async thing to have finished
    var watcher = setInterval(function() {
      // 1. If the router is loading, keep polling
      var routerIsLoading = app.__container__.lookup('router:main').router.isLoading;
      if (routerIsLoading) { return; }

      // 2. If there are pending Ajax requests, keep polling
      if (Test.pendingAjaxRequests) { return; }

      // 3. If there are scheduled timers or we are inside of a run loop, keep polling
      if (Ember.run.hasScheduledTimers() || Ember.run.currentRunLoop) { return; }

      // Stop polling
      clearInterval(watcher);

      // If this is the last async promise, end the async test
      if (--countAsync === 0) {
        Test.adapter.asyncEnd();
      }

      // Synchronously resolve the promise
      Ember.run(null, resolve, value);
    }, 10);
  });

  return buildChainObject(app, p);
}

function buildChainObject(app, p) {

  var prom = {};
  for (var i in app.testHelpers) {
    prom[i] = app.testHelpers[i];
  }

  prom.then = function(onSuccess, onFailure) {
    var prev = Ember.Test.lastPromise;

    var thenPromise = p.then(function(val) {
      return applyHelperMethod(onSuccess, [val]);
    });

    return buildChainObject(app, thenPromise);
  };

  return prom;
}


// This method isolates nested helpers
// so that they don't conflict with other last promises
function applyHelperMethod(fn, args) {
  var value, lastPromise,
      prevPromise = Ember.Test.lastPromise;

  // reset lastPromise for nested helpers
  Ember.Test.lastPromise = null;
  value = fn.apply(null, args);
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

function run(fn) {
  if (!Ember.run.currentRunLoop) {
    Ember.run(fn);
  } else {
    fn();
  }
}


// expose these methods as test helpers
helper('visit', visit);
helper('click', click);
helper('fillIn', fillIn);
helper('andThen', andThen);

helper('find', find, { wait: false });
helper('findWithAssert', findWithAssert, { wait: false} );
helper('wait', wait, { wait: false });
