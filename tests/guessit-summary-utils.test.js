'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const SummaryUtils = require('../src/scripts/guessit-summary-utils');

test('offers continue and reset for an unfinished standard game', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableRetry: true,
    enableNumChoice: false,
    hasRemainingQuestions: true,
    wordle: false
  }), {
    continueGame: true,
    resetGame: true
  });
});

test('offers continuation without the obsolete retry flag', function () {
  assert.deepEqual(SummaryUtils.getSummaryActions({
    enableRetry: false,
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
    enableRetry: true,
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
    enableRetry: true,
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
    enableRetry: true,
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
    enableRetry: true,
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
