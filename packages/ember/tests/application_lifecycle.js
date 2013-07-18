var App, container, router;

module("Application Lifecycle", {
  setup: function() {
    Ember.run(function() {
      App = Ember.Application.create({
        rootElement: '#qunit-fixture'
      });

      App.deferReadiness();

      App.Router = Ember.Router.extend({
        location: 'none'
      });

      container = App.__container__;
    });


  },

  teardown: function() {
    router = null;
    Ember.run(App, 'destroy');
  }
});

function handleURL(path) {
  router = container.lookup('router:main');
  return Ember.run(function() {
    return router.handleURL(path).then(function(value) {
      ok(true, 'url: `' + path + '` was handled');
      return value;
    }, function(reason) {
      ok(false, reason);
      throw reason;
    });
  });
}


test("Resetting the application allows controller properties to be set when a route deactivates", function() {
  App.Router.map(function() {
    this.route('home', { path: '/' });
  });
  App.HomeRoute = Ember.Route.extend({
    activate: function() {
      this.controllerFor('home').set('selectedMenuItem', 'home');
    },
    deactivate: function() {
      this.controllerFor('home').set('selectedMenuItem', null);
    }
  });
  App.ApplicationRoute = Ember.Route.extend({
    activate: function() {
      this.controllerFor('application').set('selectedMenuItem', 'home');
    },
    deactivate: function() {
      this.controllerFor('application').set('selectedMenuItem', null);
    }
  });

  var homeController = Ember.controllerFor(container, 'home');
  var applicationController = Ember.controllerFor(container, 'application');

  Ember.run(App, 'advanceReadiness');

  handleURL('/');

  equal(homeController.get('selectedMenuItem'), 'home');
  equal(applicationController.get('selectedMenuItem'), 'home');

  App.reset();

  equal(homeController.get('selectedMenuItem'), null);
  equal(applicationController.get('selectedMenuItem'), null);
});
