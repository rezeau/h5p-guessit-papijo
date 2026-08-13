(function (GuessIt) {

  /**
   * Keeps track of the number of rounds for guessing a sentence.
   *
   * @class H5P.GuessIt.Counter
   * @param {H5P.jQuery} $container
   * @param {number|string} [maxTries] Effective Wordle maximum tries.
   */
  GuessIt.Counter = function ($container, maxTries) {
    /** @alias H5P.MemoryGame.Counter# */
    const self = this;

    let current = 0;

    const hasNumericMaxTries = typeof maxTries === 'number' ||
      (typeof maxTries === 'string' && maxTries.trim() !== '');
    const numericMaxTries = Number(maxTries);
    const hasFiniteMaxTries = hasNumericMaxTries &&
      Number.isFinite(numericMaxTries) && numericMaxTries > 0;

    /**
     * @private
     */
    const update = function () {
      $container[0].innerText = String(hasFiniteMaxTries ?
        `${current}/${numericMaxTries}` :
        current);
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
