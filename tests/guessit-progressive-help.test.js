'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'scripts', 'guessit-blanks.js'),
  'utf8'
);

const getPrototypeMethodSource = function (methodName, nextMethodName) {
  const startMarker = `GuessIt.prototype.${methodName} = function (`;
  const endMarker = `GuessIt.prototype.${nextMethodName} = function (`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, `${methodName} must exist`);
  assert.notEqual(end, -1, `${nextMethodName} must follow ${methodName}`);
  return source.slice(start, end);
};

const createCloneSelection = function () {
  const selection = {
    addClass: function () {
      return this;
    },
    attr: function () {
      return this;
    },
    find: function () {
      return this;
    },
    insertBefore: function () {
      return this;
    },
    removeClass: function () {
      return this;
    }
  };
  return selection;
};

const loadProgressiveHelpPrototype = function () {
  const cloneSelection = createCloneSelection();
  const sandbox = {
    $: function () {
      return cloneSelection;
    },
    GuessIt: function () {},
    Set,
    STATE_CHECKING: 'checking',
    STATE_ONGOING: 'ongoing',
    STATE_SHOWING_SOLUTION: 'showing-solution',
    setTimeout: function (callback, delay) {
      assert.equal(delay, 20);
      callback();
    }
  };

  [
    ['toggleButtonVisibility', 'updateEndGameButtonState'],
    ['enableInCorrectInputs', 'resetBlanks'],
    ['resetBlanks', 'allBlanksFilledOut'],
    ['allBlanksFilledOut', 'markResults'],
    ['markResults', 'removeMarkedResults'],
    ['showCorrectAnswers', 'getNextUnresolvedSentenceGapIndex'],
    ['getNextUnresolvedSentenceGapIndex', 'hasUnresolvedSentenceGap'],
    ['hasUnresolvedSentenceGap', 'resetSentenceHelpState'],
    ['resetSentenceHelpState', 'finishSentenceHelp'],
    ['finishSentenceHelp', 'showNextSentenceHelp'],
    ['showNextSentenceHelp', 'toggleAllInputs'],
    ['reTry', 'newSentence'],
    ['getScore', 'getTitle']
  ].forEach(function (methods) {
    vm.runInNewContext(
      getPrototypeMethodSource(methods[0], methods[1]),
      sandbox
    );
  });

  return {
    cloneSelection,
    prototype: sandbox.GuessIt.prototype
  };
};

const createCloze = function (index, options, calls) {
  const cloze = {
    answer: options.answer || `WORD${index}`,
    checked: 0,
    correctValue: Boolean(options.correct),
    enabled: options.enabled !== false,
    filled: options.filled !== false,
    reset: 0,
    solutionVisible: false,
    status: 'neutral',
    userAnswer: options.userAnswer || '',
    checkAnswer: function () {
      this.checked++;
      this.status = this.correctValue ? 'correct' : 'wrong';
      if (this.correctValue) {
        this.enabled = false;
      }
    },
    checkCorrect: function () {
      return this.correctValue;
    },
    correct: function () {
      return this.correctValue;
    },
    enableInput: function () {
      this.enabled = true;
      calls.push(`enable:${index}`);
    },
    filledOut: function () {
      return this.filled;
    },
    getUserAnswer: function () {
      return this.userAnswer;
    },
    resetAriaLabel: function () {
      calls.push(`resetAria:${index}`);
    },
    resetBlank: function () {
      this.reset++;
      this.status = 'neutral';
      calls.push(`reset:${index}`);
    },
    setUserInput: function (value) {
      this.userAnswer = value;
      this.filled = value !== '';
      calls.push(`value:${index}:${value}`);
    },
    showSolution: function () {
      this.solutionVisible = true;
      this.enabled = false;
      calls.push(`reveal:${index}`);
    }
  };
  if (cloze.correctValue && !cloze.userAnswer) {
    cloze.userAnswer = cloze.answer;
  }
  return cloze;
};

const createHarness = function (states, options = {}) {
  const loaded = loadProgressiveHelpPrototype();
  const calls = [];
  const focused = [];
  const buttons = {};
  const clozes = states.map(function (state, index) {
    return createCloze(index, state, calls);
  });
  const question = {
    clone: function () {
      return loaded.cloneSelection;
    },
    filter: function () {
      return this;
    },
    find: function () {
      return {
        focus: function () {
          const index = clozes.findIndex(function (cloze) {
            return cloze.enabled;
          });
          focused.push(index);
        }
      };
    }
  };
  const instance = Object.assign(Object.create(loaded.prototype), {
    $questions: {
      eq: function () {
        return question;
      }
    },
    allowSolution: function (label) {
      calls.push(`allow:${label}`);
      if (options.allowed === false) {
        this.hideButton('show-solution');
        return false;
      }
      return true;
    },
    clearIncompleteAnswerWarning: function () {},
    clearWordListValidationWarning: function () {},
    clozes,
    counter: {
      increment: function () {
        calls.push('counter:increment');
      }
    },
    currentItemCompleted: false,
    currentSentenceClozes: [clozes],
    currentSentenceId: 0,
    focusButton: function (id) {
      calls.push(`focusButton:${id}`);
    },
    focusFirstEnabledInput: function () {
      question.find('input:enabled:first').focus();
    },
    getMaxScore: function () {
      return clozes.length;
    },
    hideButton: function (id) {
      buttons[id] = false;
      calls.push(`hide:${id}`);
    },
    hideSolutions: function () {
      clozes.forEach(function (cloze) {
        cloze.solutionVisible = false;
      });
      calls.push('hideSolutions');
    },
    nbSsolutionsViewed: 0,
    params: {
      behaviour: {
        enableEndGameButton: false,
        enableSolutionsButton: true
      },
      sentenceHelp: 'Help',
      wordle: Boolean(options.wordle)
    },
    removeFeedback: function () {
      calls.push('removeFeedback');
    },
    resetGrowTextField: function () {},
    sentenceHelpRevealed: new Set(),
    showButton: function (id) {
      buttons[id] = true;
      calls.push(`show:${id}`);
    },
    solutionsViewed: [],
    timer: {
      play: function () {
        calls.push('timer:play');
      },
      stop: function () {
        calls.push('timer:stop');
      }
    },
    trigger: function (event) {
      calls.push(`trigger:${event}`);
    },
    updateEndGameButtonState: function () {}
  });

  return { buttons, calls, clozes, focused, instance };
};

const checkAnswers = function (harness) {
  harness.instance.markResults();
  harness.instance.timer.stop();
  harness.instance.toggleButtonVisibility('checking');
};

const retry = function (harness) {
  harness.instance.reTry();
  harness.instance.focusFirstEnabledInput();
};

test('Help is a post-Check action with round gating preserved', function () {
  const harness = createHarness([
    { userAnswer: 'WRONG1' },
    { userAnswer: 'WRONG2' }
  ], { allowed: false });

  harness.instance.toggleButtonVisibility('ongoing');
  assert.equal(harness.buttons['check-answer'], true);
  assert.equal(harness.buttons['show-solution'], false);
  assert.equal(harness.buttons['try-again'], false);

  checkAnswers(harness);
  assert.equal(harness.buttons['check-answer'], false);
  assert.equal(harness.buttons['show-solution'], true);
  assert.equal(harness.buttons['try-again'], true);

  harness.instance.showNextSentenceHelp();
  assert.deepEqual(harness.clozes.map((cloze) => cloze.solutionVisible), [false, false]);
  assert.equal(harness.buttons['show-solution'], false);
  assert.equal(harness.calls.includes('allow:Help'), true);
});

test('Check, Help, and Try again preserve the required DOM/answer lifecycle', function () {
  const harness = createHarness([
    { correct: true },
    { userAnswer: 'WRONG1' },
    { userAnswer: 'WRONG2' },
    { correct: true },
    { userAnswer: 'WRONG4' }
  ]);

  harness.instance.toggleButtonVisibility('ongoing');
  checkAnswers(harness);
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.status),
    ['correct', 'wrong', 'wrong', 'correct', 'wrong']
  );

  harness.instance.showNextSentenceHelp();
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.solutionVisible),
    [false, true, false, false, false]
  );
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.status),
    ['correct', 'wrong', 'wrong', 'correct', 'wrong']
  );
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.userAnswer),
    ['WORD0', 'WRONG1', 'WRONG2', 'WORD3', 'WRONG4']
  );
  assert.equal(harness.buttons['check-answer'], false);
  assert.equal(harness.buttons['show-solution'], false);
  assert.equal(harness.buttons['try-again'], true);
  assert.equal(harness.calls.includes('timer:play'), false);
  assert.equal(harness.instance.nbSsolutionsViewed, 1);

  retry(harness);
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.solutionVisible),
    [false, false, false, false, false]
  );
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.status),
    ['correct', 'neutral', 'neutral', 'correct', 'neutral']
  );
  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.userAnswer),
    ['WORD0', '', '', 'WORD3', '']
  );
  assert.deepEqual(Array.from(harness.instance.sentenceHelpRevealed), []);
  assert.equal(harness.clozes[0].enabled, false);
  assert.equal(harness.clozes[3].enabled, false);
  assert.equal(harness.clozes[1].enabled, true);
  assert.deepEqual(harness.focused, [1]);
  assert.equal(harness.buttons['check-answer'], true);
  assert.equal(harness.buttons['show-solution'], false);
  assert.equal(harness.buttons['try-again'], false);
  assert.equal(harness.calls.includes('timer:play'), true);

  harness.clozes[1].setUserInput('WRONG1-AGAIN');
  harness.clozes[2].setUserInput('AGAIN2');
  harness.clozes[4].setUserInput('AGAIN4');
  checkAnswers(harness);
  harness.instance.showNextSentenceHelp();

  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.solutionVisible),
    [false, true, false, false, false]
  );
  assert.deepEqual(Array.from(harness.instance.sentenceHelpRevealed), [1]);
  assert.equal(harness.instance.nbSsolutionsViewed, 1);

  retry(harness);
  harness.clozes[1].correctValue = true;
  harness.clozes[1].setUserInput('WORD1');
  harness.clozes[2].setUserInput('STILL-WRONG2');
  harness.clozes[4].setUserInput('STILL-WRONG4');
  checkAnswers(harness);
  harness.instance.showNextSentenceHelp();

  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.solutionVisible),
    [false, false, true, false, false]
  );
  assert.deepEqual(Array.from(harness.instance.sentenceHelpRevealed), [2]);
  assert.equal(harness.instance.nbSsolutionsViewed, 1);
  assert.equal(harness.instance.getScore(), 3);
});

test('one empty or wrong unresolved target receives exactly one solution', function () {
  [
    { filled: false, userAnswer: '' },
    { filled: true, userAnswer: 'WRONG' }
  ].forEach(function (target) {
    const harness = createHarness([
      { correct: true },
      target
    ]);
    harness.instance.toggleButtonVisibility('checking');
    harness.instance.showNextSentenceHelp();

    assert.equal(harness.clozes[0].solutionVisible, false);
    assert.equal(harness.clozes[1].solutionVisible, true);
    assert.equal(harness.buttons['show-solution'], false);
    assert.equal(harness.buttons['try-again'], true);
  });
});

test('an empty previously helped slot is eligible again after Try again', function () {
  const harness = createHarness([
    { userAnswer: 'WRONG0' },
    { userAnswer: 'WRONG1' }
  ]);

  checkAnswers(harness);
  harness.instance.showNextSentenceHelp();
  retry(harness);

  assert.equal(harness.clozes[0].userAnswer, '');
  assert.equal(harness.instance.allBlanksFilledOut(), false);
  assert.equal(harness.instance.getNextUnresolvedSentenceGapIndex(), 0);
  assert.equal(harness.instance.sentenceHelpRevealed.size, 0);
});

test('Wordle keeps the legacy all-at-once solution method and button lifecycle', function () {
  const harness = createHarness([
    { userAnswer: 'A' },
    { userAnswer: 'B' },
    { userAnswer: 'C' }
  ], { wordle: true });

  harness.instance.toggleButtonVisibility('ongoing');
  assert.equal(harness.buttons['show-solution'], false);
  harness.instance.toggleButtonVisibility('checking');
  assert.equal(harness.buttons['show-solution'], true);
  harness.instance.showCorrectAnswers();

  assert.deepEqual(
    harness.clozes.map((cloze) => cloze.solutionVisible),
    [true, true, true]
  );
  assert.equal(harness.instance.nbSsolutionsViewed, 1);
  assert.equal(harness.instance.sentenceHelpRevealed.size, 0);
});

test('configured and learner-supplied sentence modes share post-Check Help', function () {
  ['availableSentences', 'userSentence'].forEach(function (playMode) {
    const harness = createHarness([
      { userAnswer: 'WRONG0' },
      { userAnswer: 'WRONG1' }
    ]);
    harness.instance.params.playMode = playMode;
    harness.instance.toggleButtonVisibility('ongoing');
    assert.equal(harness.buttons['show-solution'], false, playMode);
    checkAnswers(harness);
    harness.instance.showNextSentenceHelp();
    assert.equal(harness.clozes[0].solutionVisible, true, playMode);
    assert.equal(harness.clozes[1].solutionVisible, false, playMode);
  });
});

test('new-item reset clears Help history while content state does not persist it', function () {
  const resetStateSource = getPrototypeMethodSource(
    'resetSentenceHelpState',
    'finishSentenceHelp'
  );
  assert.match(resetStateSource, /new Set\(\)/);
  assert.doesNotMatch(
    getPrototypeMethodSource('getCurrentState', 'setH5PUserState'),
    /sentenceHelpRevealed/
  );
});
