'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SummaryUtils = require('../src/scripts/guessit-summary-utils');

test('offers continue and reset for an unfinished standard game', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: true,
    wordle: false
  }), {
    continueGame: true,
    resetGame: true
  });
});

test('offers only reset when number-of-words choice is enabled', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableNumChoice: true,
    hasRemainingQuestions: true,
    wordle: false
  }), {
    continueGame: false,
    resetGame: true
  });
});

test('offers only reset after all standard questions are completed', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: false,
    wordle: false
  }), {
    continueGame: false,
    resetGame: true
  });
});

test('offers continue and reset for an unfinished Wordle game', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: true,
    wordle: true
  }), {
    continueGame: true,
    resetGame: true
  });
});

test('offers only reset after all Wordle words are completed', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: false,
    wordle: true
  }), {
    continueGame: false,
    resetGame: true
  });
});

test('enables restricted actions on the required round', function () {
  assert.equal(SummaryUtils.hasReachedMinimumRound(1, 3), false);
  assert.equal(SummaryUtils.hasReachedMinimumRound(2, 3), false);
  assert.equal(SummaryUtils.hasReachedMinimumRound(3, 3), true);
  assert.equal(SummaryUtils.hasReachedMinimumRound('3', '3'), true);
});

test('allows summary access after completing an item in any round', function () {
  assert.equal(SummaryUtils.canViewSummary(1, 3, false), false);
  assert.equal(SummaryUtils.canViewSummary(1, 3, true), true);
  assert.equal(SummaryUtils.canViewSummary(3, 3, false), true);
});

test('sentence View Summary keeps the authored round threshold', function () {
  const params = {
    wordle: false,
    behaviour: { enableEndGameButton: true, numRounds: 4 }
  };
  const requiredRound = SummaryUtils.getEffectiveSummaryMinimumRound(
    params.wordle,
    params.behaviour.numRounds
  );

  assert.equal(requiredRound, 4);
  assert.equal(SummaryUtils.canViewSummary(3, requiredRound, false), false);
  assert.equal(SummaryUtils.canViewSummary(4, requiredRound, false), true);
});

test('Wordle View Summary ignores a hidden stored round threshold', function () {
  const params = {
    wordle: true,
    behaviour: { enableEndGameButton: true, numRounds: 4 }
  };
  const requiredRound = SummaryUtils.getEffectiveSummaryMinimumRound(
    params.wordle,
    params.behaviour.numRounds
  );

  assert.equal(requiredRound, 1);
  assert.equal(SummaryUtils.canViewSummary(1, requiredRound, false), true);
});

test('switching out of Wordle restores the stored sentence threshold', function () {
  const params = {
    wordle: true,
    behaviour: { numRounds: 4 }
  };

  assert.equal(
    SummaryUtils.getEffectiveSummaryMinimumRound(
      params.wordle,
      params.behaviour.numRounds
    ),
    1
  );
  assert.equal(params.behaviour.numRounds, 4);

  params.wordle = false;
  assert.equal(
    SummaryUtils.getEffectiveSummaryMinimumRound(
      params.wordle,
      params.behaviour.numRounds
    ),
    4
  );
  assert.equal(params.behaviour.numRounds, 4);
});
