'use strict';
/* global Map, Set */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ContentUtils = require('../src/scripts/guessit-content-utils');
const SummaryUtils = require('../src/scripts/guessit-summary-utils');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'scripts', 'guessit-blanks.js'),
  'utf8'
);
const styleSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'styles', 'guessit.css'),
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

const createSelection = function (name, registry) {
  return {
    name,
    children: [],
    classes: new Set(),
    attributes: {},
    hidden: false,
    htmlValue: '',
    length: 1,
    parent: null,
    removed: false,
    textValue: '',
    addClass: function (classNames) {
      classNames.split(/\s+/).forEach((className) => this.classes.add(className));
      return this;
    },
    append: function (...children) {
      children.forEach((child) => {
        this.children.push(child);
        if (child && typeof child === 'object') {
          child.parent = this;
        }
      });
      return this;
    },
    appendTo: function (parent) {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
      }
      parent.children.push(this);
      this.parent = parent;
      return this;
    },
    empty: function () {
      this.children = [];
      return this;
    },
    filter: function () {
      return this;
    },
    find: function () {
      return createSelection(`${name}-find`, registry);
    },
    focus: function () {
      registry.focused = this;
      return this;
    },
    hasClass: function (className) {
      return this.classes.has(className);
    },
    hide: function () {
      this.hidden = true;
      return this;
    },
    html: function (value) {
      if (value === undefined) {
        return this.htmlValue;
      }
      this.htmlValue = value;
      return this;
    },
    prependTo: function (parent) {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
      }
      parent.children.unshift(this);
      this.parent = parent;
      return this;
    },
    remove: function () {
      this.removed = true;
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
      }
      return this;
    },
    removeClass: function (classNames) {
      classNames.split(/\s+/).forEach((className) => this.classes.delete(className));
      return this;
    },
    show: function () {
      this.hidden = false;
      return this;
    },
    text: function (value) {
      if (value === undefined) {
        return this.textValue;
      }
      this.textValue = value;
      return this;
    }
  };
};

const createSelectionGroup = function (selections) {
  const uniqueSelections = Array.from(new Set(selections));
  return {
    length: uniqueSelections.length,
    hide: function () {
      uniqueSelections.forEach((selection) => selection.hide());
      return this;
    },
    show: function () {
      uniqueSelections.forEach((selection) => selection.show());
      return this;
    }
  };
};

const isAttachedTo = function (selection, root) {
  let current = selection;
  while (current) {
    if (current === root) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const isEffectivelyVisible = function (selection, root) {
  let current = selection;
  while (current) {
    if (current.hidden || current.removed) {
      return false;
    }
    if (current === root) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const getSelectionText = function (selection) {
  return [selection.htmlValue, selection.textValue]
    .concat(selection.children.map(getSelectionText))
    .filter(Boolean)
    .join(' ');
};

const countSelection = function (root, target) {
  return (root === target ? 1 : 0) + root.children.reduce(function (count, child) {
    return count + (child && child.children ? countSelection(child, target) : 0);
  }, 0);
};

const createHarness = function (options = {}) {
  const registry = {
    buttons: [],
    completedEvents: 0,
    focused: null,
    registerButtons: 0,
    registerDomElements: 0,
    resetConfirmationCreated: 0,
    resetConfirmationShown: 0,
    resetDialog: null,
    resizeEvents: 0,
    summaries: [],
    xapiEvents: 0
  };
  const content = createSelection('content', registry);
  const gameContainer = createSelection('game-container', registry);
  const titleContainer = createSelection('title-container', registry);
  const titleWrapper = createSelection('title-wrapper', registry);
  const clones = createSelection('clones', registry);
  const taskDescription = createSelection('task-description', registry);
  const guessedItems = createSelection('guessed-items', registry);
  guessedItems.tagName = options.wordle ? 'ol' : 'div';
  const progress = createSelection('progress', registry);
  const timerDom = createSelection('timer', registry);
  const ordinaryFeedback = createSelection('ordinary-feedback', registry);
  const questionIntroduction = createSelection('question-introduction', registry);
  const questionContent = createSelection('question-content', registry);
  const scoreBar = createSelection('score-bar', registry);
  const input = createSelection('answer-input', registry);
  guessedItems.addClass('h5p-guessit-hide');
  guessedItems.appendTo(taskDescription);
  taskDescription.appendTo(titleWrapper);
  titleWrapper.appendTo(titleContainer);
  titleContainer.appendTo(content);
  questionIntroduction.appendTo(gameContainer);
  questionContent.appendTo(gameContainer);
  scoreBar.appendTo(gameContainer);
  ordinaryFeedback.appendTo(gameContainer);
  gameContainer.appendTo(content);
  content.addClass('h5p-no-frame');

  const selectActivityUi = function (selector) {
    const selections = [];
    if (selector.includes('.h5p-guessit-title-container')) {
      selections.push(titleContainer);
    }
    if (selector.includes('.h5p-guessit-description')) {
      selections.push(taskDescription);
    }
    if (selector.includes('.h5p-question-introduction')) {
      selections.push(questionIntroduction);
    }
    if (selector.includes('.h5p-question-content')) {
      selections.push(questionContent);
    }
    if (selector.includes('.h5p-question-scorebar')) {
      selections.push(scoreBar);
    }
    if (selector.includes('.h5p-question-feedback')) {
      selections.push(ordinaryFeedback);
    }
    return createSelectionGroup(selections);
  };

  content.find = function (selector) {
    if (selector === '.h5p-guessit-summary-screen') {
      return registry.summaries.at(-1) || createSelection('no-summary', registry);
    }
    if (selector === '.cloned') {
      return clones;
    }
    if (selector === '.h5p-container') {
      return gameContainer;
    }
    if (selector === '.h5p-question-content') {
      return questionContent;
    }
    if (selector.includes('.h5p-guessit-title-container') ||
      selector.includes('.h5p-question-introduction')) {
      return selectActivityUi(selector);
    }
    return createSelection(`content-find:${selector}`, registry);
  };

  const questionCount = options.questionCount || 3;
  const questionNodes = Array.from({ length: questionCount }, (_, index) => {
    const question = createSelection(`question-${index}`, registry);
    question.find = function () {
      return input;
    };
    return question;
  });
  (options.usedQuestionIndices || []).forEach(function (index) {
    questionNodes[index].addClass('used');
  });
  const questions = {
    length: questionNodes.length,
    eq: function (index) {
      const resolved = index === undefined ? 0 : index;
      return questionNodes[resolved] || createSelection('missing-question', registry);
    },
    find: function () {
      return createSelection('question-find', registry);
    }
  };

  const $ = function (selector, context) {
    if (typeof selector === 'string' && selector.startsWith('<')) {
      const selection = createSelection('created', registry);
      selection.tagName = selector.match(/^<([a-z]+)/i)[1].toLowerCase();
      if (context && context.class) {
        selection.addClass(context.class);
      }
      if (context && context.text !== undefined) {
        selection.text(context.text);
      }
      if (context && context['aria-hidden'] !== undefined) {
        selection.attributes['aria-hidden'] = context['aria-hidden'];
      }
      if (selector.includes('feedback-container')) {
        selection.name = 'summary-feedback';
      }
      if (context && context.class === 'h5p-guessit-summary-screen') {
        selection.name = 'summary';
        registry.summaries.push(selection);
      }
      return selection;
    }
    if (context) {
      return selectActivityUi(selector);
    }
    if (typeof selector === 'string' && selector.includes(' .h5p-container')) {
      return gameContainer;
    }
    if (typeof selector === 'string' && selector.includes('.h5p-content')) {
      return content;
    }
    return createSelection(`selection:${selector}`, registry);
  };
  $.extend = function (deep, target, value) {
    Object.assign(target, value);
    return target;
  };

  const deferred = [];
  const sandbox = {
    $,
    ContentUtils,
    GuessIt: function () {},
    H5P: {
      Components: {
        Button: function (configuration) {
          const button = {
            configuration,
            focus: function () {
              registry.focused = button;
            },
            addEventListener: function (eventName, callback) {
              assert.equal(eventName, 'click');
              button.clickListener = callback;
            }
          };
          registry.buttons.push(button);
          return button;
        }
      },
      JoubelUI: {
        createScoreBar: function () {
          return {
            appendTo: function () {},
            setMaxScore: function () {},
            setScore: function () {}
          };
        }
      }
    },
    Math,
    STATE_ONGOING: 'ongoing',
    SummaryUtils,
    activateAutomaticQuestionPool: function (instance) {
      instance.params.questions = instance.configuredQuestionPool.slice();
    },
    activateSelectedWordLength: function () {
      return true;
    },
    normalizeWordleQuestions: function () {},
    requestWordLengthChoice: function () {},
    setCompleteQuestionPool: function (instance, pool) {
      instance.questionPool = pool;
    },
    setTimeout: function (callback, delay) {
      assert.equal(delay, 0);
      deferred.push(callback);
    }
  };

  [
    ['createHistoryContainer', 'appendWordHistoryItem'],
    ['appendWordHistoryItem', 'renderWordHistory'],
    ['renderWordHistory', 'handleGuessIt'],
    ['newSentence', 'initCounters'],
    ['initTask', 'recordCompletedItem'],
    ['recordCompletedItem', 'showFinalPage'],
    ['showFinalPage', 'continueTask'],
    ['continueTask', 'resetTask'],
    ['resetTask', 'hideButtons'],
    ['getCurrentState', 'setH5PUserState'],
    ['setH5PUserState', 'disableInput']
  ].forEach(function (methods) {
    vm.runInNewContext(
      getPrototypeMethodSource(methods[0], methods[1]),
      sandbox
    );
  });

  const timerCalls = [];
  const timer = {
    callbackCount: 1,
    currentTime: options.time || 2500,
    getTime: function () {
      return this.currentTime;
    },
    play: function () {
      timerCalls.push('play');
    },
    reset: function () {
      timerCalls.push('reset');
      this.currentTime = 0;
    },
    stop: function () {
      timerCalls.push('stop');
    }
  };
  const counterCalls = [];
  const counter = {
    currentRound: options.round || 3,
    getcurrent: function () {
      return this.currentRound;
    },
    reset: function () {
      counterCalls.push('reset');
      this.currentRound = 1;
    }
  };

  const configuredQuestions = options.configuredSentences ?
    options.configuredSentences.map(function (sentence, index) {
      return { ID: index, sentence };
    }) :
    Array.from(
      { length: questionCount },
      (_, index) => ({ ID: index, sentence: `ITEM${index}` })
    );
  const completeConfiguredQuestions = options.configuredPoolCount ?
    Array.from(
      { length: options.configuredPoolCount },
      (_, index) => ({ ID: index, sentence: `CONFIGURED${index}` })
    ) :
    configuredQuestions;
  if (!options.wordle) {
    ContentUtils.normalizeSentenceQuestions(configuredQuestions);
  }
  const completed = options.completed || [0];
  const wordsNotFound = options.wordsNotFound || [];
  const instance = Object.assign(Object.create(sandbox.GuessIt.prototype), {
    $divGuessedSentences: guessedItems,
    $feedbackContainer: ordinaryFeedback,
    $progress: progress,
    $questions: questions,
    $taskdescription: taskDescription,
    $timer: timerDom,
    acceptedWordSet: new Set(['ITEM0', 'ITEM1', 'ITEM2']),
    activeQuestionPool: configuredQuestions,
    addConfirmationDialogToButton: function (configuration, callback) {
      assert.equal(configuration.l10n, instance.params.confirmResetGame);
      registry.resetConfirmationCreated++;
      registry.resetDialog = {
        confirm: callback,
        show: function () {
          registry.resetConfirmationShown++;
        }
      };
      return registry.resetDialog;
    },
    answered: false,
    clearAnswers: function () {
      registry.answersCleared = true;
    },
    clearIncompleteAnswerWarning: function () {
      registry.incompleteWarningCleared = true;
    },
    clearWordListValidationWarning: function () {
      registry.validationWarningCleared = true;
    },
    clozes: [],
    configuredQuestionPool: completeConfiguredQuestions,
    contentId: 17,
    counter,
    currentAnswer: '',
    currentItemCompleted: true,
    currentSentenceId: 0,
    enableNumChoiceConfigured: Boolean(options.enableNumChoice),
    hasAlternatives: false,
    hadNoFrameBeforeSummary: true,
    hideButton: function () {},
    hideSolutions: function () {
      registry.solutionsHidden = true;
    },
    itemCountChoiceCompleted: true,
    itemCountChoiceEnabled: Boolean(options.itemCountChoice),
    itemCountChoicePending: false,
    learnerQuestion: null,
    nbSentencesGuessed: options.nbSentencesGuessed === undefined ?
      completed.length - wordsNotFound.length : options.nbSentencesGuessed,
    nbSsolutionsViewed: 0,
    numQuestions: questionCount,
    numQuestionsInWords: [questionCount],
    numWords: 0,
    originalQuestions: configuredQuestions,
    params: {
      behaviour: {
        enableNumChoice: Boolean(options.enableNumChoice),
        sentencesOrder: 'normal'
      },
      continueGame: 'Continue game',
      confirmResetGame: { body: 'Confirm reset' },
      playMode: options.playMode || 'availableSentences',
      questions: configuredQuestions,
      scoreBarLabel: 'Score @score/@total',
      scoreExplanationButtonLabel: 'Explain',
      scoreExplanationforAllSentences: 'Sentence score',
      scoreExplanationforAllWords: 'Word score',
      scoreExplanationforSentencesWithNumberWords: '@words words',
      sentence: 'sentence',
      sentenceGuessed: 'Sentence guessed: ',
      sentenceNotGuessed: 'Sentence not guessed: ',
      sentencesGuessed: 'Sentences guessed',
      solutionsViewed: 'Solutions viewed',
      summary: 'Summary',
      totalRounds: 'Total rounds',
      totalTimeSpent: 'Total time',
      word: 'word',
      wordFound: 'Word found: ',
      wordNotFound: 'Word not found: ',
      wordle: Boolean(options.wordle),
      wordsFound: 'Words found'
    },
    previousState: undefined,
    questionPool: configuredQuestions,
    registerButtons: function () {
      registry.registerButtons++;
    },
    registerDomElements: function () {
      registry.registerDomElements++;
    },
    removeFeedback: function () {
      registry.feedbackRemoved = true;
    },
    removeMarkedResults: function () {
      registry.markingsRemoved = true;
    },
    resetGrowTextField: function () {},
    selectedItemCount: options.selectedItemCount || questionCount,
    selectedLengthQuestionPool: options.selectedLengthQuestionPool || [],
    selectedQuestionIndices: options.selectedQuestionIndices || null,
    selectedWordLength: options.selectedWordLength || null,
    sentenceHelpRevealed: new Set(),
    sentenceResults: (options.sentenceResults || []).map(function (result) {
      return Object.assign({}, result);
    }),
    sentencesFound: 0,
    sentencesGuessed: completed.slice(),
    success: Boolean(options.success),
    timer,
    toggleAllInputs: function () {},
    toggleButtonVisibility: function () {},
    totalNumQuestions: questionCount,
    totalRounds: options.totalRounds || 0,
    totalTimeSpent: options.totalTimeSpent || 0,
    trigger: function (event) {
      if (event === 'resize') {
        registry.resizeEvents++;
      }
      else if (event && event.verb === 'completed') {
        registry.completedEvents++;
      }
    },
    triggerAnswered: function () {
      registry.xapiEvents++;
    },
    updateEndGameButtonState: function () {},
    wordLengthChoiceActivationStarted: false,
    wordLengthChoiceCompleted: options.selectedWordLength !== undefined,
    wordLengthChoiceEnabled: false,
    wordLengthChoicePending: false,
    wordLengthGroups: new Map(),
    wordLengthSelectionApplies: false,
    wordListRejectedState: options.wordListRejectedState || null,
    wordsNotFound: wordsNotFound.slice()
  });

  const displayCompletedItem = function (wordGuessed, label) {
    instance.recordCompletedItem(wordGuessed);
    if (instance.params.wordle) {
      return instance.appendWordHistoryItem(wordGuessed, label);
    }
    return instance.appendSentenceHistoryItem(true, label);
  };

  const openSummary = function () {
    const beforeChildren = gameContainer.children.length;
    instance.showFinalPage();
    assert.ok(gameContainer.children.length >= beforeChildren);
    return registry.buttons.findLast(function (button) {
      return button.configuration.classes === 'h5p-guessit-continue-button';
    });
  };

  return {
    content,
    countCompletedItemsContainers: function () {
      return countSelection(content, guessedItems);
    },
    counter,
    counterCalls,
    deferred,
    displayCompletedItem,
    gameContainer,
    getResetButton: function () {
      return registry.buttons.findLast(function (button) {
        return button.configuration.classes === 'h5p-guessit-reset-button';
      });
    },
    guessedItems,
    input,
    isAttached: function (selection) {
      return isAttachedTo(selection, content);
    },
    isVisible: function (selection) {
      return isEffectivelyVisible(selection, content);
    },
    instance,
    openSummary,
    ordinaryFeedback,
    questionNodes,
    registry,
    sandbox,
    taskDescription,
    textOf: getSelectionText,
    titleContainer,
    timer,
    timerCalls
  };
};

test('configured sentence list survives repeated actual Continue callbacks', function () {
  const harness = createHarness({
    completed: [],
    itemCountChoice: true,
    nbSentencesGuessed: 0,
    selectedItemCount: 3,
    selectedQuestionIndices: [0, 1, 2],
    time: 2500,
    round: 3
  });
  const guessedItemsIdentity = harness.guessedItems;
  harness.displayCompletedItem(true, 'ITEM0');
  harness.instance.sentenceHelpRevealed.add(0);
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, harness.taskDescription);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.match(harness.textOf(harness.guessedItems), /ITEM0/);
  assert.deepEqual(harness.instance.sentencesGuessed, [0]);
  assert.equal(harness.instance.sentenceHelpRevealed.size, 1);
  assert.equal(harness.countCompletedItemsContainers(), 1);

  const timerIdentity = harness.instance.timer;
  const feedbackIdentity = harness.instance.$feedbackContainer;
  const continueButton = harness.openSummary();
  const firstSummary = harness.registry.summaries.at(-1);

  assert.ok(continueButton);
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, firstSummary);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.match(harness.textOf(harness.guessedItems), /ITEM0/);
  assert.equal(harness.taskDescription.hidden, true);
  assert.deepEqual(harness.instance.sentencesGuessed, [0]);
  assert.equal(harness.instance.totalTimeSpent, 2500);
  assert.equal(harness.instance.totalRounds, 3);
  assert.deepEqual(harness.timerCalls, ['stop']);
  assert.equal(harness.instance.$feedbackContainer, feedbackIdentity);
  assert.equal(harness.registry.xapiEvents, 1);

  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());

  assert.equal(harness.instance.currentSentenceId, 1);
  assert.equal(harness.instance.sentencesFound, 1);
  assert.equal(harness.questionNodes[0].hasClass('used'), true);
  assert.equal(harness.instance.totalTimeSpent, 2500);
  assert.equal(harness.instance.totalRounds, 3);
  assert.equal(harness.timer.currentTime, 0);
  assert.equal(harness.counter.currentRound, 1);
  assert.deepEqual(harness.timerCalls, ['stop', 'reset', 'play']);
  assert.deepEqual(harness.counterCalls, ['reset']);
  assert.deepEqual(harness.instance.sentencesGuessed, [0]);
  assert.equal(harness.instance.sentenceHelpRevealed.size, 0);
  assert.deepEqual(harness.instance.selectedQuestionIndices, [0, 1, 2]);
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, harness.taskDescription);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.match(harness.textOf(harness.guessedItems), /ITEM0/);
  assert.equal(harness.countCompletedItemsContainers(), 1);
  assert.equal(harness.registry.summaries.at(-1).removed, true);
  assert.equal(harness.content.hasClass('h5p-no-frame'), true);
  assert.equal(harness.registry.focused, harness.input);
  assert.ok(harness.registry.resizeEvents >= 2);
  assert.equal(harness.registry.xapiEvents, 1);
  assert.equal(harness.registry.completedEvents, 0);
  assert.equal(harness.registry.registerDomElements, 0);
  assert.equal(harness.registry.registerButtons, 0);
  assert.equal(harness.instance.timer, timerIdentity);
  assert.equal(harness.instance.timer.callbackCount, 1);

  harness.displayCompletedItem(true, 'ITEM1');
  assert.match(harness.textOf(harness.guessedItems), /ITEM0/);
  assert.match(harness.textOf(harness.guessedItems), /ITEM1/);
  assert.equal(harness.guessedItems.children.length, 2);
  assert.deepEqual(harness.instance.sentencesGuessed, [0, 1]);
  harness.timer.currentTime = 1500;
  harness.counter.currentRound = 2;
  const secondContinueButton = harness.openSummary();
  const secondSummary = harness.registry.summaries.at(-1);
  assert.equal(harness.guessedItems.parent, secondSummary);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  secondContinueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, harness.taskDescription);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.equal(harness.guessedItems.children.length, 2);
  assert.match(harness.textOf(harness.guessedItems), /ITEM0/);
  assert.match(harness.textOf(harness.guessedItems), /ITEM1/);
  assert.equal(harness.countCompletedItemsContainers(), 1);
  assert.deepEqual(harness.instance.sentencesGuessed, [0, 1]);

  const state = harness.instance.getCurrentState();
  const restored = {
    learnerQuestion: null,
    params: { playMode: 'availableSentences', wordle: false },
    previousState: state
  };
  harness.sandbox.GuessIt.prototype.setH5PUserState.call(restored);
  assert.deepEqual(restored.sentencesGuessed, [0, 1]);
  assert.deepEqual(state.selectedQuestionIndices, [0, 1, 2]);
  assert.equal(state.selectedItemCount, 3);

  harness.instance.sentenceHelpRevealed.add(1);
  harness.instance.resetTask();
  assert.equal(harness.instance.sentencesGuessed.length, 0);
  assert.equal(harness.instance.wordsNotFound.length, 0);
  assert.equal(harness.instance.sentenceHelpRevealed.size, 0);
  assert.equal(harness.instance.totalTimeSpent, 0);
  assert.equal(harness.instance.totalRounds, 0);
  assert.equal(harness.instance.selectedQuestionIndices, null);
  assert.equal(harness.instance.selectedItemCount, 0);
  assert.equal(harness.registry.registerDomElements, 1);
});

test('Summary Reset confirms while the selected game has items remaining', function () {
  const harness = createHarness({
    completed: [0],
    currentItemCompleted: true,
    questionCount: 3,
    selectedItemCount: 3,
    selectedQuestionIndices: [0, 1, 2]
  });
  const progressBeforeReset = harness.instance.sentencesGuessed.slice();

  harness.openSummary();
  const resetButton = harness.getResetButton();
  resetButton.clickListener();

  assert.equal(harness.registry.resetConfirmationCreated, 1);
  assert.equal(harness.registry.resetConfirmationShown, 1);
  assert.deepEqual(harness.instance.sentencesGuessed, progressBeforeReset);
  assert.equal(harness.registry.registerDomElements, 0);

  // Cancelling is represented by leaving the confirmation callback untouched.
  assert.deepEqual(harness.instance.sentencesGuessed, progressBeforeReset);
  harness.registry.resetDialog.confirm();
  assert.equal(harness.registry.registerDomElements, 1);
  assert.equal(harness.instance.sentencesGuessed.length, 0);
});

test('Summary Reset is direct when the selected active game is exhausted', function () {
  [
    {
      label: 'one-item game',
      options: { questionCount: 1 }
    },
    {
      label: 'multi-item game',
      options: { questionCount: 3, usedQuestionIndices: [0, 1] }
    },
    {
      label: 'item-count selection from a larger configured pool',
      options: {
        configuredPoolCount: 5,
        itemCountChoice: true,
        questionCount: 2,
        selectedItemCount: 2,
        selectedQuestionIndices: [1, 3],
        usedQuestionIndices: [0]
      }
    },
    {
      label: 'restored completed active game',
      options: {
        completed: [0, 1],
        questionCount: 2,
        selectedItemCount: 2,
        selectedQuestionIndices: [0, 1],
        usedQuestionIndices: [0]
      }
    }
  ].forEach(function (scenario) {
    const harness = createHarness(Object.assign({
      currentItemCompleted: true,
      nbSentencesGuessed: 1
    }, scenario.options));

    harness.openSummary();
    harness.getResetButton().clickListener();

    assert.equal(
      harness.registry.resetConfirmationCreated,
      0,
      scenario.label
    );
    assert.equal(
      harness.registry.resetConfirmationShown,
      0,
      scenario.label
    );
    assert.equal(harness.registry.registerDomElements, 1, scenario.label);
  });
});

test('Wordle list and selection survive repeated actual Continue callbacks', function () {
  const selectedLengthPool = [
    { ID: 0, sentence: 'MARE' },
    { ID: 1, sentence: 'PINE' },
    { ID: 2, sentence: 'SAGE' }
  ];
  const harness = createHarness({
    completed: [],
    nbSentencesGuessed: 0,
    selectedItemCount: 3,
    selectedLengthQuestionPool: selectedLengthPool,
    selectedQuestionIndices: [0, 1, 2],
    selectedWordLength: 4,
    success: false,
    wordle: true,
    wordListRejectedState: { word: 'NOPE' }
  });
  const guessedItemsIdentity = harness.guessedItems;
  const foundItem = harness.displayCompletedItem(true, 'ITEM0');
  assert.equal(foundItem.tagName, 'li');
  assert.equal(foundItem.children[0].tagName, 'span');
  assert.equal(foundItem.classes.has('h5p-wordFound'), true);
  assert.equal(foundItem.children[0].attributes['aria-hidden'], 'true');
  assert.equal(foundItem.children[0].classes.has('h5p-guessit-word-result-icon-correct'), true);
  assert.equal(foundItem.children[1].textValue, 'Word found: ');
  assert.equal(foundItem.children[1].classes.has('h5p-guessit-visually-hidden'), true);
  assert.equal(foundItem.children[2].textValue, 'ITEM0');
  assert.equal(foundItem.children[2].classes.has('h5p-guessit-word-result-word'), true);
  const acceptedWordSet = harness.instance.acceptedWordSet;
  let continueButton = harness.openSummary();
  const firstSummary = harness.registry.summaries.at(-1);

  assert.equal(harness.instance.success, true);
  assert.equal(harness.guessedItems.parent, firstSummary);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.match(harness.textOf(harness.guessedItems), /Word found:\s+ITEM0/);
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());
  assert.equal(harness.instance.success, false);
  assert.equal(harness.instance.wordListRejectedState, null);
  assert.equal(harness.registry.validationWarningCleared, true);
  assert.equal(harness.instance.acceptedWordSet, acceptedWordSet);
  assert.equal(harness.instance.selectedWordLength, 4);
  assert.deepEqual(harness.instance.selectedLengthQuestionPool, selectedLengthPool);
  assert.deepEqual(harness.instance.selectedQuestionIndices, [0, 1, 2]);
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, harness.taskDescription);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.equal(harness.countCompletedItemsContainers(), 1);

  harness.instance.nbSentencesGuessed--;
  const notFoundItem = harness.displayCompletedItem(false, 'ITEM1');
  assert.equal(notFoundItem.classes.has('h5p-wordNotFound'), true);
  assert.equal(notFoundItem.children[0].attributes['aria-hidden'], 'true');
  assert.equal(notFoundItem.children[0].classes.has('h5p-guessit-word-result-icon-incorrect'), true);
  assert.equal(notFoundItem.children[1].textValue, 'Word not found: ');
  assert.equal(notFoundItem.children[1].classes.has('h5p-guessit-visually-hidden'), true);
  assert.equal(notFoundItem.children[2].textValue, 'ITEM1');
  assert.equal(harness.guessedItems.children.length, 2);
  assert.match(harness.textOf(harness.guessedItems), /Word found:\s+ITEM0/);
  assert.match(harness.textOf(harness.guessedItems), /Word not found:\s+ITEM1/);
  harness.timer.currentTime = 1500;
  harness.counter.currentRound = 2;
  continueButton = harness.openSummary();

  assert.equal(harness.instance.success, false);
  assert.equal(harness.registry.xapiEvents, 2);
  assert.equal(harness.guessedItems.parent, harness.registry.summaries.at(-1));
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());

  assert.equal(harness.instance.currentSentenceId, 2);
  assert.deepEqual(harness.instance.sentencesGuessed, [0, 1]);
  assert.deepEqual(harness.instance.wordsNotFound, [1]);
  assert.equal(harness.guessedItems, guessedItemsIdentity);
  assert.equal(harness.guessedItems.parent, harness.taskDescription);
  assert.equal(harness.isAttached(harness.guessedItems), true);
  assert.equal(harness.isVisible(harness.guessedItems), true);
  assert.equal(harness.guessedItems.children.length, 2);
  assert.match(harness.textOf(harness.guessedItems), /Word found:\s+ITEM0/);
  assert.match(harness.textOf(harness.guessedItems), /Word not found:\s+ITEM1/);
  assert.equal(harness.countCompletedItemsContainers(), 1);
  assert.equal(harness.instance.totalTimeSpent, 4000);
  assert.equal(harness.instance.totalRounds, 5);
  assert.equal(harness.registry.xapiEvents, 2);
  assert.equal(harness.registry.completedEvents, 0);
  assert.equal(harness.registry.registerDomElements, 0);
  assert.equal(harness.registry.registerButtons, 0);

  harness.instance.renderWordHistory(harness.instance.originalQuestions);
  assert.equal(harness.guessedItems.children.length, 2);
  assert.match(harness.textOf(harness.guessedItems), /Word found:\s+ITEM0/);
  assert.match(harness.textOf(harness.guessedItems), /Word not found:\s+ITEM1/);
  harness.instance.renderWordHistory(harness.instance.originalQuestions);
  assert.equal(harness.guessedItems.children.length, 2);
  assert.deepEqual(
    harness.guessedItems.children.map(function (item) {
      return item.children[2].textValue;
    }),
    ['ITEM0', 'ITEM1']
  );
});

test('Wordle history uses semantic ordered results with explicit localized status', function () {
  const harness = createHarness({
    completed: [],
    nbSentencesGuessed: 0,
    questionCount: 4,
    selectedItemCount: 4,
    selectedQuestionIndices: [0, 1, 2, 3],
    selectedWordLength: 12,
    wordle: true
  });
  const parent = createSelection('history-parent', harness.registry);
  const history = harness.instance.createHistoryContainer(
    'h5p-guessit-listGuessedWord',
    parent
  );

  assert.equal(history.tagName, 'ol');
  assert.equal(history.classes.has('h5p-guessit-listGuessedWord'), true);
  assert.equal(history.classes.has('h5p-guessit-hide'), true);

  [
    [true, 'HORSE'],
    [false, 'EXTRAORDINARILY-LONG-ZEBRA-WORD'],
    [true, 'SNAKE'],
    [false, 'TIGER']
  ].forEach(function (result, index) {
    harness.instance.currentSentenceId = index;
    harness.displayCompletedItem(result[0], result[1]);
  });

  assert.deepEqual(
    harness.guessedItems.children.map(function (item) {
      return [item.children[1].textValue, item.children[2].textValue];
    }),
    [
      ['Word found: ', 'HORSE'],
      ['Word not found: ', 'EXTRAORDINARILY-LONG-ZEBRA-WORD'],
      ['Word found: ', 'SNAKE'],
      ['Word not found: ', 'TIGER']
    ]
  );
  assert.deepEqual(harness.instance.sentencesGuessed, [0, 1, 2, 3]);
  assert.deepEqual(harness.instance.wordsNotFound, [1, 3]);
  assert.equal(harness.guessedItems.children.every(function (item) {
    return item.tagName === 'li' &&
      item.parent === harness.guessedItems &&
      item.children.length === 3;
  }), true);
  assert.equal(harness.instance.selectedWordLength, 12);
  assert.equal(harness.instance.selectedItemCount, 4);

  harness.instance.sentencesGuessed = [];
  harness.instance.wordsNotFound = [];
  harness.instance.renderWordHistory(harness.instance.originalQuestions);
  assert.equal(harness.guessedItems.children.length, 0);
  assert.equal(harness.guessedItems.hasClass('h5p-guessit-hide'), true);

  const sentenceHarness = createHarness({ completed: [], nbSentencesGuessed: 0 });
  const sentenceParent = createSelection('sentence-history-parent', sentenceHarness.registry);
  const sentenceHistory = sentenceHarness.instance.createHistoryContainer(
    'h5p-guessit-listGuessedSentences',
    sentenceParent
  );
  assert.equal(sentenceHistory.tagName, 'ol');
});

test('Wordle history CSS uses compact wrapping theme feedback items', function () {
  const listRule = styleSource.match(
    /\.h5p-guessit-listGuessedWord,\s*\.h5p-guessit-listGuessedSentences\s*\{([^}]+)\}/
  )[1];
  const itemRule = styleSource.match(/\.h5p-guessit-word-result\s*\{([^}]+)\}/)[1];
  const wordRule = styleSource.match(/\.h5p-guessit-word-result-word\s*\{([^}]+)\}/)[1];

  assert.match(listRule, /display:\s*flex/);
  assert.match(listRule, /flex-wrap:\s*wrap/);
  assert.match(listRule, /list-style:\s*none/);
  assert.match(listRule, /gap:/);
  assert.doesNotMatch(listRule, /(?:max-)?width:/);
  assert.match(itemRule, /display:\s*inline-flex/);
  assert.match(itemRule, /flex:\s*0 1 auto/);
  assert.doesNotMatch(itemRule, /(?:^|[;\s])width:/);
  assert.match(wordRule, /overflow-wrap:\s*anywhere/);
  assert.match(styleSource, /font-family:\s*'h5p-theme'/);
  assert.match(styleSource, /font-weight:\s*normal/);
  assert.match(styleSource, /h5p-guessit-word-result-icon-correct::before\s*\{\s*content:\s*"\\e903"/);
  assert.match(styleSource, /h5p-guessit-word-result-icon-incorrect::before\s*\{\s*content:\s*"\\e902"/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-correct-main\)/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-correct-secondary\)/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-correct-third\)/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-incorrect-main\)/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-incorrect-secondary\)/);
  assert.match(styleSource, /var\(--h5p-theme-feedback-incorrect-third\)/);
});

test('Sentence results use localized ordered chips and persist compatibly', function () {
  const harness = createHarness({
    completed: [],
    nbSentencesGuessed: 0,
    questionCount: 3,
    selectedItemCount: 3,
    selectedQuestionIndices: [0, 1, 2]
  });
  const historyIdentity = harness.guessedItems;
  const orderedResults = function (results) {
    return Array.from(results, function (result) {
      return [result.questionId, result.guessed];
    });
  };

  const first = harness.displayCompletedItem(true, 'Sentence one.');
  assert.equal(first.tagName, 'li');
  assert.equal(first.classes.has('h5p-wordFound'), true);
  assert.equal(
    first.classes.has('h5p-guessit-sentence-feedback-no-icon'),
    false
  );
  assert.equal(first.children[1].textValue, 'Sentence guessed: ');
  assert.equal(first.children[2].textValue, 'Sentence one.');
  let continueButton = harness.openSummary();
  assert.equal(harness.guessedItems, historyIdentity);
  assert.equal(harness.guessedItems.parent, harness.registry.summaries.at(-1));
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());

  harness.instance.currentItemCompleted = false;
  assert.deepEqual(orderedResults(harness.instance.sentenceResults), [
    [0, true]
  ]);
  continueButton = harness.openSummary();
  assert.deepEqual(orderedResults(harness.instance.sentenceResults), [
    [0, true],
    [1, false]
  ]);
  const abandoned = harness.guessedItems.children[1];
  assert.equal(abandoned.classes.has('h5p-wordNotFound'), true);
  assert.equal(
    abandoned.classes.has('h5p-guessit-sentence-feedback-no-icon'),
    false
  );
  assert.equal(abandoned.children[1].textValue, 'Sentence not guessed: ');
  assert.equal(abandoned.children[2].textValue, 'ITEM1');

  // Re-entering Summary cannot duplicate the confirmed abandoned outcome.
  harness.instance.showFinalPage();
  assert.equal(harness.instance.sentenceResults.length, 2);
  assert.equal(harness.guessedItems.children.length, 2);
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());

  harness.instance.currentItemCompleted = true;
  harness.displayCompletedItem(true, 'Sentence three.');
  assert.deepEqual(orderedResults(harness.instance.sentenceResults), [
    [0, true],
    [1, false],
    [2, true]
  ]);
  assert.deepEqual(
    harness.guessedItems.children.map(function (item) {
      return [item.children[1].textValue, item.children[2].textValue];
    }),
    [
      ['Sentence guessed: ', 'Sentence one.'],
      ['Sentence not guessed: ', 'ITEM1'],
      ['Sentence guessed: ', 'Sentence three.']
    ]
  );
  assert.deepEqual(harness.instance.sentencesGuessed, [0, 2]);
  assert.equal(harness.instance.nbSentencesGuessed, 2);

  const state = harness.instance.getCurrentState();
  const restored = {
    learnerQuestion: null,
    params: { playMode: 'availableSentences', wordle: false },
    previousState: state
  };
  harness.sandbox.GuessIt.prototype.setH5PUserState.call(restored);
  assert.deepEqual(
    orderedResults(restored.sentenceResults),
    orderedResults(harness.instance.sentenceResults)
  );

  const legacy = {
    learnerQuestion: null,
    params: { playMode: 'availableSentences', wordle: false },
    previousState: Object.assign({}, state, {
      sentenceResults: undefined,
      sentencesGuessed: [0, 2]
    })
  };
  harness.sandbox.GuessIt.prototype.setH5PUserState.call(legacy);
  assert.deepEqual(orderedResults(legacy.sentenceResults), [
    [0, true],
    [2, true]
  ]);

  harness.instance.resetTask();
  assert.equal(harness.instance.sentenceResults.length, 0);
});

test('Sentence apostrophes stay canonical through history, Summary, Continue, and restore', function () {
  const harness = createHarness({
    completed: [],
    configuredSentences: [
      'barking dogs don&#039;t bite',
      'I don&#039;t think it isn&#039;t possible',
      "An anti/constitut/ion/al act that doesn't fail"
    ],
    nbSentencesGuessed: 0,
    questionCount: 3
  });
  const questions = harness.instance.params.questions;

  assert.deepEqual(questions.map(function (question) {
    return question.sentence;
  }), [
    "barking dogs don't bite",
    "I don't think it isn't possible",
    "An anti/constitut/ion/al act that doesn't fail"
  ]);

  harness.instance.recordCompletedItem(true);
  const guessed = harness.instance.appendSentenceHistoryItem(
    true,
    harness.instance.getSentenceHistoryLabel(questions[0].sentence)
  );
  assert.equal(guessed.children[2].textValue, "barking dogs don't bite");
  assert.equal(harness.textOf(harness.guessedItems).includes('&#039;'), false);

  let continueButton = harness.openSummary();
  assert.equal(
    harness.guessedItems.parent,
    harness.registry.summaries.at(-1)
  );
  assert.match(
    harness.textOf(harness.guessedItems),
    /barking dogs don't bite/
  );
  assert.equal(
    harness.textOf(harness.guessedItems).includes('&#039;'),
    false
  );
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());
  assert.equal(harness.instance.currentSentenceId, 1);
  assert.match(harness.textOf(harness.guessedItems), /barking dogs don't bite/);

  harness.instance.currentItemCompleted = false;
  continueButton = harness.openSummary();
  const abandoned = harness.guessedItems.children[1];
  assert.equal(abandoned.children[1].textValue, 'Sentence not guessed: ');
  assert.equal(
    abandoned.children[2].textValue,
    "I don't think it isn't possible"
  );
  assert.equal(harness.textOf(harness.guessedItems).includes('&#039;'), false);
  continueButton.configuration.onClick();
  harness.deferred.splice(0).forEach((callback) => callback());

  assert.equal(
    harness.instance.getSentenceHistoryLabel(questions[2].sentence),
    "An anti/constitut/ion/al act that doesn't fail → " +
      "An anticonstitutional act that doesn't fail"
  );

  const state = harness.instance.getCurrentState();
  state.originalQuestions = [
    { ID: 0, sentence: 'barking dogs don&#039;t bite' },
    { ID: 1, sentence: 'I don&#039;t think it isn&#039;t possible' },
    { ID: 2, sentence: 'An anti/constitut/ion/al act' }
  ];
  const restored = {
    learnerQuestion: null,
    params: { playMode: 'availableSentences', wordle: false },
    previousState: state
  };
  harness.sandbox.GuessIt.prototype.setH5PUserState.call(restored);
  assert.deepEqual(restored.originalQuestions.map(function (question) {
    return question.sentence;
  }), [
    "barking dogs don't bite",
    "I don't think it isn't possible",
    'An anti/constitut/ion/al act'
  ]);

  harness.instance.sentenceResults = restored.sentenceResults;
  harness.instance.renderSentenceHistory(restored.originalQuestions);
  assert.deepEqual(
    harness.guessedItems.children.map(function (item) {
      return item.children[2].textValue;
    }),
    ["barking dogs don't bite", "I don't think it isn't possible"]
  );
  assert.equal(harness.textOf(harness.guessedItems).includes('&#039;'), false);
});

test('Sentence normalization stays outside Wordle and history keeps text insertion', function () {
  const constructorNormalization = source.indexOf(
    'ContentUtils.normalizeSentenceQuestions(this.params.questions)'
  );
  const usableQuestionFiltering = source.indexOf(
    'ContentUtils.getUsableQuestions('
  );
  const appendHistorySource = getPrototypeMethodSource(
    'appendResultHistoryItem',
    'getSentenceHistoryLabel'
  );

  assert.notEqual(constructorNormalization, -1);
  assert.ok(constructorNormalization < usableQuestionFiltering);
  assert.match(
    source.slice(constructorNormalization - 80, constructorNormalization),
    /if \(!this\.params\.wordle\)/
  );
  assert.match(appendHistorySource, /'text': label/);
  assert.doesNotMatch(appendHistorySource, /'html': label/);
  assert.doesNotMatch(
    getPrototypeMethodSource('createQuestions', 'autoGrowTextField'),
    /&#039;/
  );
});

test('production summary action gating keeps unsupported modes without Continue', function () {
  [
    { playMode: 'userSentence', questionCount: 1, wordle: false },
    { playMode: 'userSentence', questionCount: 1, wordle: true },
    { enableNumChoice: true, questionCount: 3, wordle: false }
  ].forEach(function (options) {
    const harness = createHarness(options);
    assert.equal(harness.openSummary(), undefined, JSON.stringify(options));
  });

  assert.equal(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: false,
    wordle: false
  }).continueGame, false);
  assert.equal(SummaryUtils.getSummaryActions({
    enableNumChoice: false,
    hasRemainingQuestions: false,
    wordle: true
  }).continueGame, false);
});
