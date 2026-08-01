'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ContentUtils = require('../src/scripts/guessit-content-utils');
const QuestionSelector = require('../src/scripts/guessit-question-selector');
const SummaryUtils = require('../src/scripts/guessit-summary-utils');
const WordleUtils = require('../src/scripts/guessit-wordle-utils');

const sourcePath = path.join(
  __dirname,
  '..',
  'src',
  'scripts',
  'guessit-blanks.js'
);
const source = fs.readFileSync(sourcePath, 'utf8');

const createQuestion = function (word) {
  return { sentence: word };
};

const createFiveLetterWord = function (index) {
  let value = index;
  let suffix = '';
  for (let position = 0; position < 4; position++) {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return `A${suffix}`;
};

test('pending word-length choice is distinct from empty and item-count states', function () {
  const pool = [createQuestion('WORD')];

  assert.equal(
    ContentUtils.getConfiguredListState(
      'availableSentences',
      pool,
      true,
      true
    ),
    'item-count-choice'
  );
  assert.equal(
    ContentUtils.getConfiguredListState(
      'availableSentences',
      pool,
      false,
      true
    ),
    'word-length-choice'
  );
  assert.equal(
    ContentUtils.getConfiguredListState(
      'availableSentences',
      [],
      false,
      true
    ),
    'empty'
  );
  assert.equal(
    ContentUtils.getConfiguredListState('userSentence', [], false, true),
    'learner-supplied'
  );
});

test('saved indices are strictly local to the selected-length pool', function () {
  const helperSource = source.slice(0, source.indexOf('H5P.GuessIt ='));
  const moduleHolder = { exports: {} };
  const sandbox = {
    Array,
    JSON,
    Map,
    Math,
    Number,
    Set,
    module: moduleHolder,
    require: function (request) {
      const modules = {
        './guessit-content-utils': ContentUtils,
        './guessit-question-selector': QuestionSelector,
        './guessit-summary-utils': SummaryUtils,
        './guessit-wordle-utils': WordleUtils
      };
      return modules[request];
    }
  };

  vm.runInNewContext(
    helperSource +
      '\nmodule.exports = {' +
      'activateSelectedWordLength,' +
      'activateAutomaticQuestionPool,' +
      'activateQuestionPool,' +
      'isSelectionValidForPool' +
      '};',
    sandbox
  );
  const helpers = moduleHolder.exports;
  const fourLetterPool = [
    createQuestion('WORD'),
    createQuestion('PLAY')
  ];
  const instance = {
    acceptedWordSet: new Set(),
    questionPool: [],
    selectedLengthQuestionPool: [],
    wordLengthChoiceCompleted: false,
    wordLengthChoicePending: true,
    wordLengthGroups: new Map([[4, fourLetterPool]]),
    wordListValidationEnabled: true
  };

  assert.equal(helpers.activateSelectedWordLength(instance, 4), true);
  assert.notEqual(instance.selectedLengthQuestionPool, fourLetterPool);
  assert.deepEqual(
    instance.selectedLengthQuestionPool.map(function (question) {
      return question.sentence;
    }),
    ['WORD', 'PLAY']
  );
  assert.equal(instance.questionPool, instance.selectedLengthQuestionPool);
  assert.equal(helpers.isSelectionValidForPool(instance.questionPool, [1]), true);
  assert.equal(helpers.isSelectionValidForPool(instance.questionPool, [2]), false);
  assert.equal(helpers.isSelectionValidForPool(instance.questionPool, [0, 0]), false);
  assert.equal(helpers.activateSelectedWordLength(instance, 5), false);

  const fiveLetterPool = Array.from(
    { length: 25 },
    function (value, index) {
      return createQuestion(createFiveLetterWord(index));
    }
  );
  instance.wordLengthGroups.set(5, fiveLetterPool);
  instance.params = {
    behaviour: { sentencesOrder: 'random' },
    wordle: true
  };
  assert.equal(helpers.activateSelectedWordLength(instance, 5), true);
  helpers.activateAutomaticQuestionPool(instance);
  assert.equal(instance.selectedLengthQuestionPool.length, 25);
  assert.equal(instance.activeQuestionPool.length, 20);
  assert.equal(instance.acceptedWordSet.size, 25);
  assert.equal(instance.activeQuestionPool.every(function (question) {
    return WordleUtils.getWordleWordLength(question.sentence) === 5;
  }), true);

  assert.equal(helpers.activateSelectedWordLength(instance, 5), true);
  assert.equal(helpers.isSelectionValidForPool(instance.questionPool, [24]), true);
  helpers.activateQuestionPool(instance, [24]);
  assert.deepEqual(Array.from(instance.selectedQuestionIndices), [24]);
  assert.equal(
    instance.activeQuestionPool[0].sentence,
    fiveLetterPool[24].sentence
  );

  instance.wordListValidationEnabled = false;
  assert.equal(helpers.activateSelectedWordLength(instance, 4), true);
  assert.equal(instance.selectedLengthQuestionPool.length, 2);
  assert.equal(instance.acceptedWordSet.size, 0);
});

test('semantics and every localization have aligned word-length fields', function () {
  const root = path.join(__dirname, '..');
  const semantics = JSON.parse(fs.readFileSync(
    path.join(root, 'semantics.json'),
    'utf8'
  ));
  const behaviourIndex = semantics.findIndex(function (field) {
    return field.name === 'behaviour';
  });
  const behaviour = semantics[behaviourIndex];
  const settingIndex = behaviour.fields.findIndex(function (field) {
    return field.name === 'enableWordLengthChoice';
  });
  const setting = behaviour.fields[settingIndex];
  assert.equal(setting.default, false);
  assert.equal(setting.optional, true);
  assert.equal(setting.label, 'Allow the learner to select the word length');
  assert.deepEqual(setting.showWhen, {
    type: 'and',
    rules: [
      { field: '../wordle', equals: true },
      { field: '../playModeW', equals: 'availableSentences' },
      { field: 'enableItemCountChoice', equals: false }
    ]
  });

  const stringNames = ['wordLengthQuestion', 'letter', 'letters'];
  const stringIndices = stringNames.map(function (name) {
    return semantics.findIndex(function (field) {
      return field.name === name;
    });
  });
  assert.deepEqual(
    stringIndices.map(function (index) {
      return semantics[index].default;
    }),
    ['Select the word length:', 'letter', 'letters']
  );

  const expectedDefaults = {
    '.en.json': ['Select the word length:', 'letter', 'letters'],
    'fr.json': ['Sélectionnez la longueur du mot :', 'lettre', 'lettres'],
    'pt.json': ['Selecione o comprimento da palavra:', 'letra', 'letras'],
    'pt-br.json': ['Selecione o tamanho da palavra:', 'letra', 'letras'],
    'pt-pt.json': ['Selecione o comprimento da palavra:', 'letra', 'letras']
  };
  Object.entries(expectedDefaults).forEach(function ([fileName, defaults]) {
    const language = JSON.parse(fs.readFileSync(
      path.join(root, 'language', fileName),
      'utf8'
    ));
    assert.equal(language.semantics.length, semantics.length, fileName);
    assert.equal(
      language.semantics[behaviourIndex].fields[settingIndex].label.length > 0,
      true,
      fileName
    );
    assert.deepEqual(
      stringIndices.map(function (index) {
        return language.semantics[index].default;
      }),
      defaults,
      fileName
    );
  });
});

test('selector uses the complete selected group and initializes only once', function () {
  const originalH5P = global.H5P;
  const originalSetTimeout = global.setTimeout;
  const buttons = [];
  const input = {
    focusCount: 0,
    focus: function () {
      this.focusCount++;
      return this;
    }
  };

  class FakeNode {
    constructor(attributes = {}) {
      this.attributes = attributes;
      this.children = [];
      this.focusCount = 0;
      this.removed = false;
    }

    appendTo(parent) {
      parent.children.push(this);
      return this;
    }

    append(child) {
      this.children.push(child);
      return this;
    }

    find(selector) {
      if (selector === 'button:first') {
        const queue = this.children.slice();
        while (queue.length) {
          const child = queue.shift();
          if (child.isButton) {
            return child;
          }
          if (child.children) {
            queue.push(...child.children);
          }
        }
      }
      return input;
    }

    focus() {
      this.focusCount++;
      return this;
    }

    remove() {
      this.removed = true;
      return this;
    }
  }

  const contentNode = new FakeNode();
  const jquery = function (selector, attributes) {
    if (typeof selector === 'string' && selector.startsWith('<')) {
      return new FakeNode(attributes);
    }
    return contentNode;
  };
  const Question = function () {};
  Question.prototype = {};
  global.H5P = {
    Components: {
      Button: function (options) {
        const button = new FakeNode();
        button.isButton = true;
        button.options = options;
        buttons.push(button);
        return button;
      }
    },
    Question,
    jQuery: jquery
  };
  global.setTimeout = function (callback) {
    callback();
    return 0;
  };

  try {
    delete require.cache[require.resolve('../src/scripts/guessit-blanks.js')];
    require('../src/scripts/guessit-blanks.js');
    const GuessIt = global.H5P.GuessIt;
    const fiveLetterQuestions = Array.from(
      { length: 25 },
      function (value, index) {
        return createQuestion(createFiveLetterWord(index));
      }
    );
    const groups = new Map([
      [5, fiveLetterQuestions],
      [4, [createQuestion('WORD')]]
    ]);
    let renderCount = 0;
    let initCount = 0;
    let resizeCount = 0;
    const instance = {
      activeQuestionPool: [],
      contentId: 42,
      params: {
        behaviour: { sentencesOrder: 'normal' },
        letter: 'letter',
        letters: 'letters',
        playMode: 'availableSentences',
        word: 'word',
        wordLengthQuestion: 'Select the word length:',
        wordle: true,
        words: 'words'
      },
      previousState: { wordLengthChoiceCompleted: false },
      questionPool: [],
      registerDomElements: function () {
        renderCount++;
        initCount++;
      },
      selectedLengthQuestionPool: [],
      trigger: function (eventName) {
        if (eventName === 'resize') {
          resizeCount++;
        }
      },
      wordLengthChoiceActivationStarted: false,
      wordLengthChoiceCompleted: false,
      wordLengthChoicePending: true,
      wordLengthGroups: groups,
      wordListValidationEnabled: true
    };

    const choice = GuessIt.prototype.createWordLengthChoice.call(instance);
    instance.$wordLengthChoice = choice;

    assert.deepEqual(
      buttons.map(function (button) {
        return button.options.label;
      }),
      ['4 letters [1 word]', '5 letters [25 words]']
    );
    assert.equal(buttons[0].options.ariaLabel, buttons[0].options.label);
    choice.find('button:first').focus();
    assert.equal(buttons[0].focusCount, 1);

    buttons[1].options.onClick();
    buttons[1].options.onClick();
    buttons[1].options.onClick();

    assert.equal(instance.selectedWordLength, 5);
    assert.equal(instance.selectedLengthQuestionPool.length, 25);
    assert.equal(instance.questionPool.length, 25);
    assert.equal(instance.activeQuestionPool.length, 20);
    assert.deepEqual(instance.selectedQuestionIndices, Array.from(
      { length: 20 },
      function (value, index) {
        return index;
      }
    ));
    assert.equal(instance.acceptedWordSet.size, 25);
    assert.equal(
      WordleUtils.isAcceptedWord(
        fiveLetterQuestions[24].sentence,
        instance.acceptedWordSet
      ),
      true
    );
    assert.equal(
      WordleUtils.isAcceptedWord('WORD', instance.acceptedWordSet),
      false
    );
    assert.equal(renderCount, 1);
    assert.equal(initCount, 1);
    assert.equal(resizeCount, 1);
    assert.equal(choice.removed, true);
    assert.equal(input.focusCount, 1);
    assert.equal(instance.previousState, undefined);

    instance.originalQuestions = instance.activeQuestionPool;
    instance.sentencesGuessed = [];
    instance.wordsNotFound = [];
    instance.nbSentencesGuessed = 0;
    instance.totalRounds = 0;
    instance.nbSsolutionsViewed = 0;
    instance.totalTimeSpent = 0;
    instance.itemCountChoiceCompleted = true;
    instance.selectedItemCount = 20;
    const state = GuessIt.prototype.getCurrentState.call(instance);
    assert.equal(state.wordLengthChoiceCompleted, true);
    assert.equal(state.selectedWordLength, 5);
    assert.deepEqual(state.selectedQuestionIndices, instance.selectedQuestionIndices);
  }
  finally {
    global.H5P = originalH5P;
    global.setTimeout = originalSetTimeout;
  }
});

test('source retains focus, resize, reset, and restoration safeguards', function () {
  assert.match(source, /H5P\.Components\.Button\(\{/);
  assert.match(source, /'aria-labelledby': headingId/);
  assert.match(source, /'role': 'group'/);
  assert.match(source, /\.sort\(function \(a, b\)/);
  assert.match(source, /wordLengthChoiceActivationStarted/);
  assert.match(source, /\$wordLengthChoice\.find\('button:first'\)\.focus\(\)/);
  assert.match(
    source,
    /activateSelectedWordLength\(self, wordLength\)[\s\S]*activateAutomaticQuestionPool\(self\)[\s\S]*self\.registerDomElements\(\)/
  );
  assert.match(
    source,
    /activateSelectedWordLength\(\s*this,\s*this\.previousState\.selectedWordLength\s*\)[\s\S]*isSelectionValidForPool/
  );
  assert.match(source, /else if \(this\.wordLengthChoiceEnabled\) \{\s*requestWordLengthChoice\(this\)/);
  assert.match(source, /state\.wordLengthChoiceCompleted/);
  assert.match(source, /state\.selectedWordLength/);
  const retryStart = source.indexOf('GuessIt.prototype.reTry = function');
  const retryEnd = source.indexOf(
    'GuessIt.prototype.newSentence = function',
    retryStart
  );
  const retrySource = source.slice(retryStart, retryEnd);
  assert.doesNotMatch(retrySource, /requestWordLengthChoice/);
  assert.doesNotMatch(retrySource, /selectedWordLength\s*=/);
  const nextItemStart = source.indexOf(
    'GuessIt.prototype.newSentence = function'
  );
  const nextItemEnd = source.indexOf(
    'GuessIt.prototype.initCounters = function',
    nextItemStart
  );
  const nextItemSource = source.slice(nextItemStart, nextItemEnd);
  assert.doesNotMatch(nextItemSource, /requestWordLengthChoice/);
  assert.doesNotMatch(nextItemSource, /selectedWordLength\s*=/);
  assert.doesNotMatch(
    GuessItSelectorSource(),
    /\.keydown\(|\.keyup\(/
  );
});

const GuessItSelectorSource = function () {
  const start = source.indexOf(
    'GuessIt.prototype.createWordLengthChoice = function'
  );
  const end = source.indexOf(
    '/**\n   * Registers this question type',
    start
  );
  return source.slice(start, end);
};
