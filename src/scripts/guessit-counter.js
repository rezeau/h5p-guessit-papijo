(function (GuessIt) {

  /**
   * Keeps track of the number of rounds for guessing a sentence.
   *
   * @class H5P.GuessIt.Counter
   * @param {H5P.jQuery} $container
   */
  GuessIt.Counter = function ($container) {
    /** @alias H5P.MemoryGame.Counter# */
    var self = this;

    var current = 0;

    /**
     * @private
     */
    var update = function () {
      $container[0].innerText = current;
    };

    /**
     * Increment the counter.
     */
    self.increment = function () {
      current++;
      update();
    };

    /**
     * Revert counter back to its natural state
     */
    self.reset = function () {
      current = 1;
      update();
    };
    
    self.getcurrent = function () {
      return current;
    };

  };

})(H5P.GuessIt);
