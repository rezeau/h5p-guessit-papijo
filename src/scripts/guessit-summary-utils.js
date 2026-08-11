'use strict';

/**
 * Determine which controls belong on the final summary screen.
 *
 * @param {object} options Summary configuration.
 * @param {boolean} options.enableNumChoice Whether number-of-words choice is enabled.
 * @param {boolean} options.hasRemainingQuestions Whether play can continue.
 * @returns {{continueGame: boolean, resetGame: boolean}} Summary actions.
 */
const getSummaryActions = function (options) {
  const resetGame = true;
  const continueGame = !options.enableNumChoice &&
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

/**
 * Get the effective round threshold for opening the summary.
 *
 * Wordle does not expose this setting to authors, so it uses the semantic
 * default without changing the stored sentence-mode value.
 *
 * @param {boolean} wordle Whether Wordle mode is active.
 * @param {number|string} configuredRound Authored sentence-mode threshold.
 * @returns {number|string} Effective minimum round for View Summary.
 */
const getEffectiveSummaryMinimumRound = function (wordle, configuredRound) {
  return wordle ? 1 : configuredRound;
};

/**
 * Allow summary access after completing an item or reaching the round limit.
 *
 * @param {number|string} currentRound Current displayed round.
 * @param {number|string} requiredRound Minimum allowed round.
 * @param {boolean} itemCompleted Whether the current item is complete.
 * @returns {boolean} Whether summary access is available.
 */
const canViewSummary = function (currentRound, requiredRound, itemCompleted) {
  return itemCompleted || hasReachedMinimumRound(currentRound, requiredRound);
};

module.exports = {
  canViewSummary,
  getEffectiveSummaryMinimumRound,
  getSummaryActions,
  hasReachedMinimumRound
};
