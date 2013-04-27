require('ember-testing/setup');

var Promise = Ember.RSVP.Promise,
    registerTestHelper = Ember.registerTestHelper;

registerTestHelper('visit', function(App, url) {
  Ember.run(App, App.handleURL, url);
  return window.wait();
});

registerTestHelper('click', function(App, selector) {
  Ember.run(function() {
    Ember.$(selector).click();
  });
  return window.wait();
});

registerTestHelper('fillIn', function(App, selector, text) {
  var $el = window.find(selector);
  Ember.run(function() {
    $el.val(text);
  });
  return window.wait();
});

registerTestHelper('find', function(App, selector) {
  return Ember.$('.ember-application').find(selector);
});

registerTestHelper('wait', function(App, value) {
  return new Promise(function(resolve) {
    stop();
    var watcher = setInterval(function() {
      var routerIsLoading = App.__container__.lookup('router:main').router.isLoading;
      if (routerIsLoading) { return; }
      if (App.get('pendingAjaxRequests')) { return; }
      if (Ember.run.hasScheduledTimers() || Ember.run.currentRunLoop) { return; }
      clearInterval(watcher);
      start();
      Ember.run(function() {
        resolve(value);
      });
    }, 10);
  });
});
