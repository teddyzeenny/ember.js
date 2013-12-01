Ember.RSVP = requireModule('rsvp');

Ember.RSVP.onerrorDefault = function(error) {
  if (error instanceof Error) {
    Ember.Logger.error(error.stack);

    if (Ember.testing) {
      throw error;
    } else {
      Ember.assert(error, false);
    }
  }
};

Ember.RSVP.on('error', Ember.RSVP.onerrorDefault);
