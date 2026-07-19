'use strict';

/**
 * Determine which controls belong on the final summary screen.
 *
 * @param {object} options Summary configuration.
 * @param {boolean} options.enableRetry Whether continuing is enabled.
 * @param {boolean} options.enableNumChoice Whether number-of-words choice is enabled.
 * @param {boolean} options.hasRemainingQuestions Whether play can continue.
 * @param {boolean} options.wordle Whether Wordle mode is active.
 * @returns {{continueGame: boolean, resetGame: boolean}} Summary actions.
 */
const getSummaryActions = function (options) {
  const resetGame = !options.wordle;
  const continueGame = resetGame &&
    options.enableRetry &&
    !options.enableNumChoice &&
    options.hasRemainingQuestions;

  return { continueGame, resetGame };
};

/**
 * Check whether the current round has reached the configured threshold.
 *
 * @param {number|string} currentRound Current displayed round.
 * @param {number|string} requiredRound Minimum allowed round.
 * @returns {boolean} Whether the restricted action is available.
 */
const hasReachedMinimumRound = function (currentRound, requiredRound) {
  return Number(currentRound) >= Number(requiredRound);
};

module.exports = { getSummaryActions, hasReachedMinimumRound };
