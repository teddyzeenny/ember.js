
var originalSetTimeout = window.setTimeout,
    originalDateValueOf = Date.prototype.valueOf;

module('Ember.run.later', {
  teardown: function() {
    window.setTimeout = originalSetTimeout;
    Date.prototype.valueOf = originalDateValueOf;
  }
});

var previousPreventRunloop;

asyncTest('should invoke after specified period of time - function only', function() {

  var invoked = false;

  Ember.run(function() {
    Ember.run.later(function() { invoked = true; }, 100);
  });

  setTimeout(function() {
    start();
    equal(invoked, true, 'should have invoked later item');
  }, 150);

});


asyncTest('should invoke after specified period of time - target/method', function() {

  var obj = { invoked: false } ;

  Ember.run(function() {
    Ember.run.later(obj, function() { this.invoked = true; }, 100);
  });

  setTimeout(function() {
    start();
    equal(obj.invoked, true, 'should have invoked later item');
  }, 150);

});


asyncTest('should invoke after specified period of time - target/method/args', function() {

  var obj = { invoked: 0 } ;

  Ember.run(function() {
    Ember.run.later(obj, function(amt) { this.invoked += amt; }, 10, 100);
  });

  setTimeout(function() {
    start();
    equal(obj.invoked, 10, 'should have invoked later item');
  }, 150);

});

asyncTest('should always invoke within a separate runloop', function() {
  var obj = { invoked: 0 }, firstRunLoop, secondRunLoop;

  Ember.run(function() {
    firstRunLoop = Ember.run.currentRunLoop;

    Ember.run.later(obj, function(amt) {
      this.invoked += amt;
      secondRunLoop = Ember.run.currentRunLoop;
    }, 10, 1);

    // Synchronous "sleep". This simulates work being done
    // after run.later was called but before the run loop
    // has flushed. In previous versions, this would have
    // caused the run.later callback to have run from
    // within the run loop flush, since by the time the
    // run loop has to flush, it would have considered
    // the timer already expired.
    var pauseUntil = +new Date() + 100;
    while(+new Date() < pauseUntil) { /* do nothing - sleeping */ }
  });

  ok(firstRunLoop, "first run loop captured");
  ok(!Ember.run.currentRunLoop, "shouldn't be in a run loop after flush");
  equal(obj.invoked, 0, "shouldn't have invoked later item yet");

  setTimeout(function() {
    start();
    equal(obj.invoked, 10, "should have invoked later item");
    ok(secondRunLoop, "second run loop took place");
    ok(secondRunLoop !== firstRunLoop, "two different run loops took place");
  }, 150);
});

asyncTest('callback order', function() {
  var array = [];
  function fn(val) { array.push(val); }

  Ember.run(function() {
    Ember.run.later(this, fn, 4, 5);
    Ember.run.later(this, fn, 1, 1);
    Ember.run.later(this, fn, 5, 10);
    Ember.run.later(this, fn, 2, 3);
    Ember.run.later(this, fn, 3, 3);
  });

  deepEqual(array, []);

  setTimeout(function() {
    start();
    deepEqual(array, [1,2,3,4,5], 'callbacks were called in expected order');
  }, 100);
});

asyncTest('callbacks coalesce into same run loop if expiring at the same time', function() {
  var array = [];
  function fn(val) { array.push(Ember.run.currentRunLoop); }

  Ember.run(function() {

    // Force +new Date to return the same result while scheduling
    // run.later timers. Otherwise: non-determinism!
    var now = +new Date();
    Date.prototype.valueOf = function() { return now; };

    Ember.run.later(this, fn, 10);
    Ember.run.later(this, fn, 200);
    Ember.run.later(this, fn, 200);

    Date.prototype.valueOf = originalDateValueOf;
  });

  deepEqual(array, []);

  setTimeout(function() {
    start();
    equal(array.length, 3, 'all callbacks called');
    ok(array[0] !== array[1], 'first two callbacks have different run loops');
    ok(array[0], 'first runloop present');
    ok(array[1], 'second runloop present');
    equal(array[1], array[2], 'last two callbacks got the same run loop');
  }, 500);
});

asyncTest('inception calls to run.later should run callbacks in separate run loops', function() {

  var runLoop, finished;

  Ember.run(function() {
    runLoop = Ember.run.currentRunLoop;
    ok(runLoop);

    Ember.run.later(function() {
      ok(Ember.run.currentRunLoop && Ember.run.currentRunLoop !== runLoop,
         'first later callback has own run loop');
      runLoop = Ember.run.currentRunLoop;

      Ember.run.later(function() {
        ok(Ember.run.currentRunLoop && Ember.run.currentRunLoop !== runLoop,
           'second later callback has own run loop');
        finished = true;
      }, 40);
    }, 40);
  });

  setTimeout(function() {
    start();
    ok(finished, 'all .later callbacks run');
  }, 250);
});

asyncTest('setTimeout should never run with a negative wait', function() {

  // Rationale: The old run loop code was susceptible to an occasional
  // bug where invokeLaterTimers would be scheduled with a setTimeout
  // with a negative wait. Modern browsers normalize this to 0, but
  // older browsers (IE <= 8) break with a negative wait, which
  // happens when an expired timer callback takes a while to run,
  // which is what we simulate here.
  var newSetTimeoutUsed;
  window.setTimeout = function() {
    var wait = arguments[arguments.length - 1];
    newSetTimeoutUsed = true;
    ok(!isNaN(wait) && wait >= 0, 'wait is a non-negative number');
    // In IE8, `setTimeout.apply` is `undefined`.
    var apply = Function.prototype.apply;
    return apply.apply(originalSetTimeout, [this, arguments]);
  };

  var count = 0;
  Ember.run(function() {

    Ember.run.later(function() {
      count++;

      // This will get run first. Waste some time.
      // This is intended to break invokeLaterTimers code by taking a
      // long enough time that other timers should technically expire. It's
      // fine that they're not called in this run loop; just need to
      // make sure that invokeLaterTimers doesn't end up scheduling
      // a negative setTimeout.
      var pauseUntil = +new Date() + 60;
      while(+new Date() < pauseUntil) { /* do nothing - sleeping */ }
    }, 1);

    Ember.run.later(function() {
      equal(count, 1, 'callbacks called in order');
    }, 50);
  });

  originalSetTimeout(function() {
    window.setTimeout = originalSetTimeout;
    start();
    ok(newSetTimeoutUsed, 'stub setTimeout was used');
  }, 200);
});
