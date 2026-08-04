'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ContentUtils = require('../src/scripts/guessit-content-utils');

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

const createElement = function (tag, options = {}) {
  return {
    appendedTo: null,
    children: [],
    options,
    selector: null,
    tag,
    appendTo: function (parent) {
      this.appendedTo = parent;
      parent.children.push(this);
      return this;
    },
    find: function (selector) {
      const result = createElement('selection');
      result.selector = selector;
      result.source = this;
      return result;
    }
  };
};

test('initCounters preserves progress behavior without creating global $content', function () {
  const sandbox = {
    GuessIt: function () {},
    $: function (tag, options) {
      return createElement(tag, options);
    }
  };
  const timerEvents = [];
  const counterEvents = [];
  sandbox.GuessIt.Timer = function ($element) {
    assert.equal($element.selector, '.h5p-time-spent');
    this.play = function () {
      timerEvents.push('play');
    };
  };
  sandbox.GuessIt.Counter = function ($element) {
    assert.equal($element.selector, '.h5p-counter');
    this.increment = function () {
      counterEvents.push('increment');
    };
  };
  vm.runInNewContext(
    getPrototypeMethodSource('initCounters', 'initTask'),
    sandbox
  );

  const progressWrapper = createElement('progress-wrapper');
  const instance = {
    $progressWrapper: progressWrapper,
    contentId: 17,
    numQuestions: 3,
    params: {
      playMode: 'availableSentences',
      round: 'Round @round',
      sentence: 'sentence',
      timeSpent: 'Time Spent',
      word: 'Word',
      wordle: false
    }
  };

  sandbox.GuessIt.prototype.initCounters.call(instance);

  assert.deepEqual(timerEvents, ['play']);
  assert.deepEqual(counterEvents, ['increment']);
  assert.equal(instance.$timer.appendedTo, progressWrapper);
  assert.equal(instance.$counter.options.html.includes('Round '), true);
  assert.equal(instance.$progress.options.text, 'Sentence 1/3');
  assert.equal(Object.hasOwn(sandbox, '$content'), false);

  const learnerInstance = {
    $progressWrapper: createElement('progress-wrapper'),
    contentId: 18,
    numQuestions: 1,
    params: {
      playMode: 'userSentence',
      round: 'Round @round',
      sentence: 'sentence',
      timeSpent: 'Time Spent',
      word: 'Word',
      wordle: false
    }
  };
  sandbox.GuessIt.prototype.initCounters.call(learnerInstance);

  assert.equal(learnerInstance.$progress, undefined);
  assert.equal(Object.hasOwn(sandbox, '$content'), false);
});

test('sentence groups emit a valid role without a malformed id attribute', function () {
  const markupLine = source.split(/\r?\n/).find(function (line) {
    return line.includes("h5p-guessit-sentence-hidden");
  });

  assert.ok(markupLine);
  assert.match(markupLine, /class = "h5p-guessit-sentence h5p-guessit-sentence-hidden"/);
  assert.match(markupLine, / role="group" aria-labelledby=/);
  assert.doesNotMatch(markupLine, /id=role/);
  assert.doesNotMatch(markupLine, /\sid\s*=/);
  assert.equal((markupLine.match(/role="group"/g) || []).length, 1);
});

test('eventCompleted passes the current GuessIt instance as xAPI receiver', function () {
  const sandbox = {
    GuessIt: function () {},
    Math
  };
  vm.runInNewContext(
    getPrototypeMethodSource('eventCompleted', 'addTip'),
    sandbox
  );

  const scoredArguments = [];
  const completedEvent = {
    data: {
      statement: {
        result: {}
      }
    },
    setScoredResult: function (...args) {
      scoredArguments.push(args);
    }
  };
  const instance = {
    createXAPIEventTemplate: function (verb) {
      assert.equal(verb, 'completed');
      return completedEvent;
    },
    timer: {
      getTime: function () {
        return 1234;
      }
    },
    trigger: function (event) {
      assert.equal(event, completedEvent);
    }
  };

  sandbox.GuessIt.prototype.eventCompleted.call(instance);

  assert.deepEqual(scoredArguments[0].slice(0, 2), [1, 1]);
  assert.equal(scoredArguments[0][2], instance);
  assert.deepEqual(scoredArguments[0].slice(3), [true, true]);
  assert.equal(completedEvent.data.statement.result.duration, 'PT1.23S');
});

test('word-count selector appends translated Any number after numeric choices', function () {
  const registerSource = getPrototypeMethodSource(
    'registerDomElements',
    'createQuestions'
  );

  assert.match(registerSource, /ContentUtils\.getWordCountChoices/);
  assert.ok(
    registerSource.indexOf('wordCountChoices.forEach') <
      registerSource.indexOf('const item = self.params.anyNumber')
  );
});

test('learner Wordle completes the real summary and xAPI sequence', function () {
  const createSelection = function () {
    return {
      addClass: function () { return this; },
      append: function () { return this; },
      appendTo: function () { return this; },
      empty: function () { return this; },
      eq: function () { return createSelection(); },
      find: function () { return createSelection(); },
      hasClass: function () { return false; },
      hide: function () { return this; },
      prependTo: function () { return this; },
      remove: function () { return this; },
      removeClass: function () { return this; },
      show: function () { return this; }
    };
  };
  const $ = function () {
    return createSelection();
  };
  $.extend = function (deep, target, sourceValue) {
    Object.assign(target, sourceValue);
    return target;
  };

  const sandbox = {
    $,
    ContentUtils,
    GuessIt: function () {},
    H5P: {},
    Math,
    SummaryUtils: {
      getSummaryActions: function () {
        return { continueGame: false, resetGame: false };
      }
    },
    activateAutomaticQuestionPool: function (instance) {
      instance.params.questions = [];
      instance.activeQuestionPool = [];
      instance.originalQuestions = [];
      instance.totalNumQuestions = 0;
    },
    activateSelectedWordLength: function () { return false; },
    normalizeWordleQuestions: function () {},
    requestWordLengthChoice: function () {},
    setCompleteQuestionPool: function (instance, pool) {
      instance.questionPool = pool;
    }
  };
  [
    ['recordCompletedItem', 'showFinalPage'],
    ['showFinalPage', 'resetTask'],
    ['resetTask', 'hideButtons'],
    ['triggerAnswered', 'getXAPIData'],
    ['getxAPIDefinition', 'addQuestionToXAPI'],
    ['addQuestionToXAPI', 'parseSolution'],
    ['addResponseToXAPI', 'getxAPIResponse'],
    ['getxAPIResponse', 'getMaxScore'],
    ['getCurrentState', 'setH5PUserState'],
    ['setH5PUserState', 'disableInput']
  ].forEach(function (methodNames) {
    vm.runInNewContext(
      getPrototypeMethodSource(methodNames[0], methodNames[1]),
      sandbox
    );
  });

  const xAPIEvents = [];
  const createRuntimeParts = function (instance) {
    instance.counter = {
      getcurrent: function () { return 2; }
    };
    instance.timer = {
      getTime: function () { return 1200; },
      stop: function () {}
    };
    instance.$timer = createSelection();
  };

  const instance = Object.assign(Object.create(sandbox.GuessIt.prototype), {
    $questions: createSelection(),
    activeQuestionPool: [],
    answered: false,
    clearWordListValidationWarning: function () {},
    clozes: [],
    configuredQuestionPool: [],
    contentId: 17,
    createXAPIEventTemplate: function (verb) {
      assert.equal(verb, 'answered');
      const statement = {
        context: {},
        object: { definition: {} },
        result: {}
      };
      return {
        data: { statement },
        getVerifiedStatementValue: function (pathParts) {
          if (pathParts[0] === 'context') {
            return statement.context;
          }
          return statement.object.definition;
        },
        setScoredResult: function (score, maxScore, receiver, completed, success) {
          statement.result.score = { max: maxScore, raw: score };
          statement.result.completion = completed;
          statement.result.success = success;
          assert.equal(receiver, instance);
        }
      };
    },
    enableNumChoiceConfigured: false,
    hasAlternatives: false,
    hideButton: function () {},
    itemCountChoiceEnabled: false,
    learnerQuestion: null,
    nbSentencesGuessed: 0,
    nbSsolutionsViewed: 0,
    params: {
      behaviour: { enableNumChoice: false },
      playMode: 'userSentence',
      questions: [],
      scoreExplanationforAllWords: 'Word score explanation',
      sentencesGuessed: 'Sentences guessed',
      solutionsViewed: 'Solutions viewed',
      summary: 'Summary',
      totalRounds: 'Total rounds',
      totalTimeSpent: 'Total time',
      wordFound: 'Word found: ',
      wordNotFound: 'Word not found: ',
      wordsFound: 'Words found',
      wordle: true
    },
    previousState: {
      nbSentencesGuessed: 0,
      nbSsolutionsViewed: 0,
      originalQuestions: [],
      sentencesGuessed: [],
      totalRounds: 0,
      totalTimeSpent: 0,
      wordsNotFound: []
    },
    sentencesGuessed: [],
    success: false,
    totalNumQuestions: 0,
    totalRounds: 0,
    totalTimeSpent: 0,
    trigger: function (event) {
      if (typeof event !== 'string') {
        xAPIEvents.push(event);
      }
    },
    wordsNotFound: [],
    wordLengthChoiceEnabled: false,
    wordLengthGroups: new Map(),
    wordLengthSelectionApplies: false,
    removeFeedback: function () {},
    registerDomElements: function () {
      createRuntimeParts(this);
    }
  });
  createRuntimeParts(instance);

  const question = ContentUtils.setLearnerQuestion(
    instance,
    'PRÉCÉDER',
    undefined,
    false
  );
  sandbox.GuessIt.prototype.setH5PUserState.call(instance);

  assert.equal(instance.params.questions[0], question);
  assert.equal(instance.originalQuestions[0], question);
  assert.equal(instance.questionPool[0], question);
  assert.equal(instance.activeQuestionPool[0], question);
  assert.equal(question.ID, 0);

  instance.currentSentenceId = 0;
  sandbox.GuessIt.prototype.recordCompletedItem.call(instance, true);
  sandbox.GuessIt.prototype.showFinalPage.call(instance);

  assert.equal(xAPIEvents.length, 1);
  assert.match(
    xAPIEvents[0].data.statement.result.response,
    /^Word found: PRÉCÉDER\n/
  );
  assert.deepEqual(
    xAPIEvents[0].data.statement.result.score,
    { max: 1, raw: 1 }
  );
  assert.equal(xAPIEvents[0].data.statement.result.completion, true);
  assert.equal(xAPIEvents[0].data.statement.result.success, true);
  assert.equal(instance.totalTime, '0 min 01 s');

  sandbox.GuessIt.prototype.resetTask.call(instance);
  const secondQuestion = ContentUtils.setLearnerQuestion(
    instance,
    'SECOND',
    undefined,
    false
  );
  instance.currentSentenceId = 0;
  sandbox.GuessIt.prototype.recordCompletedItem.call(instance, true);
  sandbox.GuessIt.prototype.showFinalPage.call(instance);

  assert.equal(secondQuestion.ID, 0);
  assert.equal(xAPIEvents.length, 2);
  assert.match(
    xAPIEvents[1].data.statement.result.response,
    /^Word found: SECOND\n/
  );
  assert.deepEqual(
    xAPIEvents[1].data.statement.result.score,
    { max: 1, raw: 1 }
  );
});

test('configured-list and learner sentence saved-state behavior remain intact', function () {
  let normalizedQuestions;
  const sandbox = {
    ContentUtils,
    GuessIt: function () {},
    normalizeWordleQuestions: function (questions) {
      normalizedQuestions = questions;
    }
  };
  vm.runInNewContext(
    getPrototypeMethodSource('setH5PUserState', 'disableInput'),
    sandbox
  );
  vm.runInNewContext(
    getPrototypeMethodSource('recordCompletedItem', 'showFinalPage'),
    sandbox
  );
  vm.runInNewContext(
    getPrototypeMethodSource('getxAPIResponse', 'getMaxScore'),
    sandbox
  );

  const configuredQuestion = { ID: 0, sentence: 'APPLE' };
  const configuredInstance = {
    currentSentenceId: 0,
    nbSentencesGuessed: 0,
    nbSsolutionsViewed: 0,
    params: {
      playMode: 'availableSentences',
      questions: [configuredQuestion],
      solutionsViewed: 'Solutions viewed',
      totalRounds: 'Total rounds',
      wordFound: 'Word found: ',
      wordNotFound: 'Word not found: ',
      wordle: true
    },
    previousState: {
      nbSentencesGuessed: 0,
      nbSsolutionsViewed: 0,
      originalQuestions: [configuredQuestion],
      sentencesGuessed: [],
      totalRounds: 0,
      totalTimeSpent: 0,
      wordsNotFound: []
    },
    sentencesGuessed: [],
    totalRounds: 1,
    wordsNotFound: []
  };
  sandbox.GuessIt.prototype.setH5PUserState.call(configuredInstance);
  assert.equal(configuredInstance.originalQuestions[0], configuredQuestion);
  assert.equal(normalizedQuestions, configuredInstance.originalQuestions);
  sandbox.GuessIt.prototype.recordCompletedItem.call(
    configuredInstance,
    true
  );
  assert.match(
    sandbox.GuessIt.prototype.getxAPIResponse.call(
      configuredInstance,
      configuredInstance.originalQuestions
    ),
    /^Word found: APPLE\n/
  );

  const sentenceInstance = createLearnerSentenceInstance();
  const learnerQuestion = ContentUtils.setLearnerQuestion(
    sentenceInstance,
    'A learner supplied sentence',
    'A retained tip',
    true
  );
  sandbox.GuessIt.prototype.setH5PUserState.call(sentenceInstance);
  assert.equal(sentenceInstance.originalQuestions[0], learnerQuestion);
  assert.equal(sentenceInstance.originalQuestions[0].tip, 'A retained tip');
  sentenceInstance.currentSentenceId = 0;
  sandbox.GuessIt.prototype.recordCompletedItem.call(sentenceInstance, true);
  assert.match(
    sandbox.GuessIt.prototype.getxAPIResponse.call(
      sentenceInstance,
      sentenceInstance.originalQuestions
    ),
    /^A learner supplied sentence\n/
  );
});

const createLearnerSentenceInstance = function () {
  return {
    activeQuestionPool: [],
    learnerQuestion: null,
    params: {
      playMode: 'userSentence',
      questions: [],
      solutionsViewed: 'Solutions viewed',
      totalRounds: 'Total rounds',
      wordle: false
    },
    previousState: {
      nbSentencesGuessed: 0,
      nbSsolutionsViewed: 0,
      originalQuestions: [],
      sentencesGuessed: [],
      totalRounds: 0,
      totalTimeSpent: 0,
      wordsNotFound: []
    },
    questionPool: [],
    sentencesGuessed: [],
    totalRounds: 0,
    wordsNotFound: []
  };
};
