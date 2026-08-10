'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WordleUtils = require('../src/scripts/guessit-wordle-utils');

const createInput = function (initialValue, disabled = false) {
  let value = initialValue;
  return {
    disabled,
    isInput: true,
    focus: function () {
      this.focused = true;
      return this;
    },
    val: function (newValue) {
      if (newValue === undefined) {
        return value;
      }
      value = newValue;
      return this;
    }
  };
};

const loadGuessIt = function () {
  const emptyCollection = {
    last: function () {
      return this;
    },
    length: 0,
    parents: function () {
      return this;
    }
  };
  const jquery = function (value) {
    return value && value.isInput ? value : emptyCollection;
  };

  global.document = { body: {} };
  global.H5P = {
    jQuery: jquery,
    Question: function () {}
  };

  delete require.cache[require.resolve('../src/scripts/guessit-blanks')];
  require('../src/scripts/guessit-blanks');
  return global.H5P.GuessIt;
};

const createCheckHarness = function (options = {}) {
  const GuessIt = loadGuessIt();
  const buttons = {};
  const callbacks = {};
  const calls = [];
  const lockedIndices = options.lockedIndices || [];
  const inputs = (options.letters || ['Z', 'Z', 'Z', 'Z', 'Z'])
    .map(function (letter, index) {
      return createInput(letter, lockedIndices.includes(index));
    });
  const inputCollection = {
    each: function (callback) {
      inputs.forEach(function (input) {
        callback.call(input);
      });
    }
  };
  const questionCollection = {
    eq: function () {
      return {
        filter: function () {
          return this;
        },
        find: function (selector) {
          if (selector === 'input') {
            return inputCollection;
          }
          if (selector === 'input:enabled:first' ||
            selector === '.h5p-text-input.wordle:enabled:first') {
            const firstEnabled = inputs.find(function (input) {
              return !input.disabled;
            });
            return {
              focus: function () {
                if (firstEnabled) {
                  firstEnabled.focus();
                }
              }
            };
          }
          return {
            removeClass: function () {
              calls.push('removeClass');
            }
          };
        }
      };
    }
  };
  const instance = Object.create(GuessIt.prototype);

  instance.contentId = 1;
  instance.currentSentenceId = 0;
  instance.$questions = questionCollection;
  instance.$timer = {};
  instance.timer = {
    play: function () {
      calls.push('timer.play');
    },
    reset: function () {
      calls.push('timer.reset');
    },
    stop: function () {
      calls.push('timer.stop');
    }
  };
  instance.counter = {
    getcurrent: function () {
      return 2;
    },
    increment: function () {
      calls.push('counter.increment');
    }
  };
  instance.params = {
    behaviour: {
      listGuessedSentences: false,
      listGuessedAudioAndTips: 'none'
    },
    checkAnswer: 'Check',
    confirmEndGame: {},
    endGame: 'View Summary',
    newSentence: 'Guess another sentence',
    newWord: 'Guess another word',
    notFilledOut: 'Fill every cell',
    playMode: options.playMode || 'availableSentences',
    questions: [{ ID: 0, sentence: 'APPLE' }],
    sentenceHelp: 'Help',
    sentenceHelpDescription: 'Show next missing word',
    showSolutions: 'Show solution',
    tryAgain: 'Try again',
    wordle: options.wordle !== false,
    wordNotInList: 'Sorry, this word is not in the word list.'
  };
  instance.wordListValidationEnabled = options.validationEnabled;
  instance.acceptedWordSet = options.acceptedWordSet || new Set();
  instance.wordListRejectedState = null;
  instance.currentSentenceClozes = [
    inputs.map(function (input, index) {
      const locked = lockedIndices.includes(index);
      return {
        isCorrectlyLocked: function () {
          return locked;
        },
        resetWordListRejectedCell: function () {
          calls.push(`resetRejectedCell:${index}`);
          input.val('');
          input.disabled = false;
        }
      };
    })
  ];
  instance.sentencesGuessed = [];
  instance.wordsNotFound = [];
  instance.nbSentencesGuessed = 0;
  instance.sentencesFound = 0;
  instance.numQuestions = 1;
  instance.confirmEndGameEnabled = false;

  instance.addButton = function (id, label, callback, visible, attributes) {
    callbacks[id] = callback;
    buttons[id] = {
      ariaLabel: attributes && attributes['aria-label'],
      focused: false,
      label,
      visible: true
    };
  };
  instance.addConfirmationDialogToButton = function () {
    return null;
  };
  instance.allBlanksFilledOut = function () {
    return true;
  };
  instance.clearWordListValidationWarning = function () {
    calls.push('clearWarning');
  };
  instance.showWordListValidationWarning = function () {
    calls.push('showWarning');
  };
  instance.initCounters = function () {
    calls.push('initCounters');
  };
  instance.setFeedback = function () {
    calls.push('setFeedback');
  };
  instance.updateFeedbackContent = function () {
    calls.push('updateFeedbackContent');
  };
  instance.toggleButtonVisibility = function () {
    calls.push('toggleButtonVisibility');
  };
  instance.markResults = function () {
    calls.push('markResults');
  };
  instance.getScore = function () {
    calls.push('getScore');
    return 0;
  };
  instance.getMaxScore = function () {
    calls.push('getMaxScore');
    return 1;
  };
  instance.maxTriesReached = function () {
    calls.push('maxTriesReached');
    return false;
  };
  instance.getCurrentState = function () {
    calls.push('getCurrentState');
  };
  instance.triggerAnswered = function () {
    calls.push('triggerAnswered');
  };
  instance.showButton = function (id) {
    calls.push(`showButton:${id}`);
    buttons[id] = buttons[id] || {
      focused: false
    };
    buttons[id].visible = true;
  };
  instance.hideButton = function (id) {
    calls.push(`hideButton:${id}`);
    buttons[id] = buttons[id] || {
      focused: false
    };
    buttons[id].visible = false;
  };
  instance.focusButton = function (id) {
    if (buttons[id] && buttons[id].visible) {
      Object.keys(buttons).forEach(function (buttonId) {
        buttons[buttonId].focused = false;
      });
      inputs.forEach(function (input) {
        input.focused = false;
      });
      buttons[id].focused = true;
      calls.push(`focusButton:${id}`);
    }
  };
  instance.trigger = function (eventName) {
    calls.push(`trigger:${eventName}`);
  };
  instance.resetGrowTextField = function () {
    calls.push('resetGrowTextField');
  };
  instance.reTry = function () {
    calls.push('reTry');
  };
  instance.addTip = function () {};
  instance.addAudio = function () {};
  instance.showCorrectAnswers = function () {};
  instance.newSentence = function () {};
  instance.allowSolution = function () {
    return true;
  };
  instance.showFinalPage = function () {};

  instance.registerButtons();
  calls.length = 0;

  return {
    buttons,
    calls,
    check: callbacks['check-answer'],
    inputs,
    instance,
    pressButtonKey: function (id, key) {
      if (buttons[id].focused &&
        (key === 'Enter' || key === ' ')) {
        callbacks[id]();
      }
    },
    pressInputKey: function (index, key) {
      Object.keys(buttons).forEach(function (buttonId) {
        buttons[buttonId].focused = false;
      });
      inputs[index].focus();
      if (key !== 'Enter' && key !== ' ') {
        return;
      }
    },
    retry: callbacks['try-again']
  };
};

test('an unlisted word focuses Try again in the neutral special-retry state', async function () {
  const harness = createCheckHarness({
    acceptedWordSet: WordleUtils.createAcceptedWordSet([
      { sentence: 'APPLE' }
    ]),
    validationEnabled: true
  });
  const historyBefore = harness.instance.sentencesGuessed.slice();
  const wordsNotFoundBefore = harness.instance.wordsNotFound.slice();

  harness.check();
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });

  assert.deepEqual(harness.calls, [
    'showWarning',
    'hideButton:check-answer',
    'showButton:try-again',
    'trigger:resize',
    'focusButton:try-again'
  ]);
  assert.equal(harness.buttons['try-again'].focused, true);
  assert.equal(harness.inputs.some(function (input) {
    return input.focused;
  }), false);
  assert.deepEqual(harness.instance.sentencesGuessed, historyBefore);
  assert.deepEqual(harness.instance.wordsNotFound, wordsNotFoundBefore);
  assert.equal(harness.instance.nbSentencesGuessed, 0);
  assert.equal(harness.instance.currentAnswer, undefined);
  assert.equal(harness.instance.currentWordleAnswer, undefined);
  assert.equal(harness.calls.includes('markResults'), false);
  assert.equal(harness.calls.includes('getScore'), false);
  assert.equal(harness.calls.includes('getCurrentState'), false);
  assert.equal(harness.calls.includes('triggerAnswered'), false);
  assert.deepEqual(
    harness.inputs.map(function (input) {
      return input.val();
    }),
    ['Z', 'Z', 'Z', 'Z', 'Z']
  );
});

test('rejection neither changes the round nor stops the running timer', function () {
  const harness = createCheckHarness({
    acceptedWordSet: WordleUtils.createAcceptedWordSet([
      { sentence: 'APPLE' }
    ]),
    validationEnabled: true
  });
  const roundBefore = harness.instance.counter.getcurrent();
  harness.instance.$timer = undefined;

  harness.check();

  assert.equal(harness.instance.counter.getcurrent(), roundBefore);
  assert.equal(harness.calls.includes('initCounters'), false);
  assert.equal(harness.calls.includes('counter.increment'), false);
  assert.equal(harness.calls.includes('timer.stop'), false);
  assert.equal(harness.calls.includes('timer.reset'), false);
  assert.equal(harness.calls.includes('timer.play'), false);
});

test('special Try again preserves only cells that were already locked green', function () {
  const harness = createCheckHarness({
    acceptedWordSet: WordleUtils.createAcceptedWordSet([
      { sentence: 'APPLE' }
    ]),
    letters: ['S', 'A', 'T', 'Z', 'R'],
    lockedIndices: [0, 4],
    validationEnabled: true
  });
  const roundBefore = harness.instance.counter.getcurrent();

  harness.check();
  assert.deepEqual(
    harness.instance.wordListRejectedState.lockedCells,
    [0, 4]
  );
  harness.calls.length = 0;
  harness.retry();

  assert.deepEqual(
    harness.inputs.map(function (input) {
      return input.val();
    }),
    ['S', '', '', '', 'R']
  );
  assert.equal(harness.inputs[0].disabled, true);
  assert.equal(harness.inputs[4].disabled, true);
  assert.equal(harness.inputs[1].focused, true);
  assert.equal(harness.instance.counter.getcurrent(), roundBefore);
  assert.equal(harness.instance.wordListRejectedState, null);
  assert.equal(harness.calls.includes('counter.increment'), false);
  assert.equal(harness.calls.includes('timer.stop'), false);
  assert.equal(harness.calls.includes('timer.reset'), false);
  assert.equal(harness.calls.includes('timer.play'), false);
  assert.equal(harness.calls.includes('reTry'), false);
  assert.equal(harness.calls.includes('clearWarning'), true);
  assert.equal(
    harness.calls.includes('hideButton:try-again'),
    true
  );
  assert.equal(
    harness.calls.includes('showButton:check-answer'),
    true
  );
  [0, 4].forEach(function (index) {
    assert.equal(
      harness.calls.includes(`resetRejectedCell:${index}`),
      false
    );
  });
});

[' ', 'Enter'].forEach(function (key) {
  const keyName = key === ' ' ? 'Space' : 'Enter';

  test(`${keyName} on focused Try again invokes special retry once`, async function () {
    const harness = createCheckHarness({
      acceptedWordSet: WordleUtils.createAcceptedWordSet([
        { sentence: 'APPLE' }
      ]),
      letters: ['S', 'A', 'T', 'Z', 'R'],
      lockedIndices: [0, 4],
      validationEnabled: true
    });

    harness.check();
    await new Promise(function (resolve) {
      setTimeout(resolve, 30);
    });
    harness.calls.length = 0;
    harness.pressButtonKey('try-again', key);

    assert.equal(
      harness.calls.filter(function (call) {
        return call === 'resetRejectedCell:1';
      }).length,
      1
    );
    assert.equal(harness.instance.wordListRejectedState, null);
    assert.equal(harness.inputs[1].focused, true);
    assert.equal(harness.calls.includes('reTry'), false);
  });
});

test('Space in an editable Wordle cell does not invoke special retry', async function () {
  const harness = createCheckHarness({
    acceptedWordSet: WordleUtils.createAcceptedWordSet([
      { sentence: 'APPLE' }
    ]),
    validationEnabled: true
  });

  harness.check();
  await new Promise(function (resolve) {
    setTimeout(resolve, 30);
  });
  harness.calls.length = 0;
  harness.pressInputKey(0, ' ');

  assert.notEqual(harness.instance.wordListRejectedState, null);
  assert.equal(
    harness.calls.some(function (call) {
      return call.startsWith('resetRejectedCell:');
    }),
    false
  );
  assert.equal(harness.calls.includes('reTry'), false);
});

test('a listed word outside the active subset follows the normal Check path', function () {
  const completeConfiguredPool = [
    { sentence: 'APPLE' },
    { sentence: 'ÉTAGE' }
  ];
  const harness = createCheckHarness({
    acceptedWordSet: WordleUtils.createAcceptedWordSet(
      completeConfiguredPool
    ),
    letters: ['e', 't', 'a', 'g', 'e'],
    validationEnabled: true
  });

  harness.instance.params.questions = [
    { ID: 0, sentence: 'APPLE' }
  ];
  harness.check();

  assert.equal(harness.calls.includes('showWarning'), false);
  assert.equal(harness.calls.includes('clearWarning'), true);
  assert.equal(harness.calls.includes('setFeedback'), true);
  assert.equal(harness.calls.includes('markResults'), true);
  assert.equal(harness.calls.includes('timer.stop'), true);
  assert.equal(harness.instance.currentWordleAnswer, 'ETAGE');
});

test('disabled or missing validation preserves legacy Wordle behaviour', function () {
  [false, undefined].forEach(function (validationEnabled) {
    const harness = createCheckHarness({ validationEnabled });
    harness.check();

    assert.equal(harness.calls.includes('showWarning'), false);
    assert.equal(harness.calls.includes('markResults'), true);
  });
});

test('incomplete input preserves the existing feedback and focus behaviour', function () {
  const harness = createCheckHarness({
    letters: ['A', '', 'P', 'L', 'E'],
    validationEnabled: true
  });
  harness.instance.$timer = undefined;
  harness.instance.allBlanksFilledOut = function () {
    return false;
  };

  harness.check();

  assert.deepEqual(harness.calls, [
    'initCounters',
    'setFeedback',
    'updateFeedbackContent'
  ]);
  assert.equal(harness.inputs[1].focused, true);
});

test('normal evaluated-attempt Try again retains the existing retry path', function () {
  const harness = createCheckHarness({ validationEnabled: false });

  harness.retry();

  assert.deepEqual(harness.calls, [
    'updateFeedbackContent',
    'reTry'
  ]);
  assert.equal(harness.inputs[0].focused, true);
});

[' ', 'Enter'].forEach(function (key) {
  const keyName = key === ' ' ? 'Space' : 'Enter';

  test(`normal retry ${keyName} keyboard behaviour remains unchanged`, function () {
    const harness = createCheckHarness({ validationEnabled: false });

    harness.instance.focusButton('try-again');
    harness.calls.length = 0;
    harness.pressButtonKey('try-again', key);

    assert.deepEqual(harness.calls, [
      'updateFeedbackContent',
      'reTry'
    ]);
    assert.equal(harness.inputs[0].focused, true);
  });
});

test('learner-supplied-word and non-Wordle modes remain unaffected', function () {
  const learnerWord = createCheckHarness({
    playMode: 'userSentence',
    validationEnabled: false
  });
  learnerWord.check();
  assert.equal(learnerWord.calls.includes('markResults'), true);

  const sentenceMode = createCheckHarness({
    validationEnabled: false,
    wordle: false
  });
  sentenceMode.check();
  assert.equal(sentenceMode.calls.includes('markResults'), true);
});

test('sentence Help and Wordle solution buttons keep isolated labels', function () {
  const sentenceMode = createCheckHarness({
    validationEnabled: false,
    wordle: false
  });
  assert.equal(sentenceMode.buttons['show-solution'].label, 'Help');
  assert.equal(
    sentenceMode.buttons['show-solution'].ariaLabel,
    'Show next missing word'
  );

  const wordleMode = createCheckHarness({ validationEnabled: false });
  assert.equal(wordleMode.buttons['show-solution'].label, 'Show solution');
  assert.equal(wordleMode.buttons['show-solution'].ariaLabel, 'Show solution');
});

test('warning uses plain text without retaining focus in a Wordle input', function () {
  const GuessIt = loadGuessIt();
  const instance = Object.create(GuessIt.prototype);
  let warningText = '';
  let hidden = true;
  let focused = false;
  instance.params = {
    wordNotInList: '<img src=x> Sorry, this word is not in the word list.'
  };
  instance.currentSentenceId = 0;
  instance.$wordListValidationMessage = {
    prop: function (name, value) {
      assert.equal(name, 'hidden');
      hidden = value;
      return this;
    },
    text: function (value) {
      warningText = value;
      return this;
    }
  };
  instance.$questions = {
    eq: function () {
      return {
        filter: function () {
          return this;
        },
        find: function () {
          return {
            focus: function () {
              focused = true;
            }
          };
        }
      };
    }
  };
  instance.trigger = function () {};

  instance.showWordListValidationWarning();
  assert.equal(
    warningText,
    '<img src=x> Sorry, this word is not in the word list.'
  );
  assert.equal(hidden, false);
  assert.equal(focused, false);

  instance.clearWordListValidationWarning();
  assert.equal(warningText, '');
  assert.equal(hidden, true);
});

test('semantics default to disabled and use the exact warning', function () {
  const semantics = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'semantics.json'),
    'utf8'
  ));
  const behaviour = semantics.find(function (field) {
    return field.name === 'behaviour';
  });
  const option = behaviour.fields.find(function (field) {
    return field.name === 'enableWordListValidation';
  });
  const warning = semantics.find(function (field) {
    return field.name === 'wordNotInList';
  });

  assert.equal(option.default, false);
  assert.deepEqual(option.showWhen.rules, [
    { field: '../wordle', equals: true },
    { field: '../playModeW', equals: 'availableSentences' }
  ]);
  assert.equal(
    warning.default,
    'Sorry, this word is not in the word list.'
  );
});

test('the Set precedes selection and lifecycle paths clear rejected state', function () {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'scripts',
      'guessit-blanks.js'
    ),
    'utf8'
  );

  assert.ok(
    source.indexOf('this.acceptedWordSet =') <
      source.indexOf('if (this.itemCountChoiceEnabled')
  );
  ['reTry', 'initTask', 'resetTask'].forEach(function (methodName) {
    const methodStart = source.indexOf(
      `GuessIt.prototype.${methodName} = function`
    );
    const nextMethod = source.indexOf(
      'GuessIt.prototype.',
      methodStart + 20
    );
    const methodSource = source.slice(
      methodStart,
      nextMethod === -1 ? source.length : nextMethod
    );
    assert.match(methodSource, /wordListRejectedState = null/);
    assert.match(methodSource, /clearWordListValidationWarning\(\)/);
  });
});
