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

const getAnswerInputHandler = function (sandbox) {
  const createQuestionsSource = getPrototypeMethodSource(
    'createQuestions',
    'autoGrowTextField'
  );
  const marker = "}).on('input', function (event) {";
  const markerIndex = createQuestionsSource.indexOf(marker);
  const start = createQuestionsSource.indexOf(
    'function (event) {',
    markerIndex
  );
  const end = createQuestionsSource.indexOf(
    "    }).on('compositionend'",
    start
  );

  assert.notEqual(markerIndex, -1, 'answer inputs must use the input event');
  assert.notEqual(end, -1, 'composition completion handler must follow input');
  return vm.runInNewContext(
    `(${createQuestionsSource.slice(start, end)}})`,
    sandbox
  );
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
  const deferredCallbacks = [];
  const sandbox = {
    GuessIt: function () {},
    $: function (tag, options) {
      return createElement(tag, options);
    },
    setTimeout: function (callback, delay) {
      assert.equal(delay, 0);
      deferredCallbacks.push(callback);
    }
  };
  const timerEvents = [];
  const counterEvents = [];
  const counterMaxTries = [];
  sandbox.GuessIt.Timer = function ($element) {
    assert.equal($element.selector, '.h5p-time-spent');
    this.play = function () {
      timerEvents.push('play');
    };
  };
  sandbox.GuessIt.Counter = function ($element, maxTries) {
    assert.equal($element.selector, '.h5p-counter');
    counterMaxTries.push(maxTries);
    this.increment = function () {
      counterEvents.push('increment');
    };
  };
  vm.runInNewContext(
    getPrototypeMethodSource('initCounters', 'initTask'),
    sandbox
  );

  const progressWrapper = createElement('progress-wrapper');
  let resizeCount = 0;
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
    },
    trigger: function (eventName) {
      assert.equal(eventName, 'resize');
      resizeCount++;
    }
  };

  sandbox.GuessIt.prototype.initCounters.call(instance);

  assert.deepEqual(timerEvents, ['play']);
  assert.deepEqual(counterEvents, ['increment']);
  assert.equal(instance.$timer.appendedTo, progressWrapper);
  assert.equal(instance.$counter.options.html.includes('Round '), true);
  assert.equal(instance.$progress.options.text, 'Sentence 1/3');
  assert.equal(Object.hasOwn(sandbox, '$content'), false);
  assert.equal(resizeCount, 0);
  assert.equal(deferredCallbacks.length, 1);
  deferredCallbacks.shift()();
  assert.equal(resizeCount, 1);

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
    },
    trigger: function (eventName) {
      assert.equal(eventName, 'resize');
      resizeCount++;
    }
  };
  sandbox.GuessIt.prototype.initCounters.call(learnerInstance);

  assert.equal(learnerInstance.$progress, undefined);
  assert.equal(Object.hasOwn(sandbox, '$content'), false);
  assert.equal(deferredCallbacks.length, 1);
  deferredCallbacks.shift()();
  assert.equal(resizeCount, 2);

  const wordleInstance = {
    $progressWrapper: createElement('progress-wrapper'),
    contentId: 19,
    numQuestions: 4,
    params: {
      behaviour: { maxTries: 6 },
      playMode: 'availableSentences',
      round: 'Round @round',
      sentence: 'sentence',
      timeSpent: 'Time Spent',
      word: 'Word',
      wordle: true
    },
    trigger: function (eventName) {
      assert.equal(eventName, 'resize');
      resizeCount++;
    }
  };
  sandbox.GuessIt.prototype.initCounters.call(wordleInstance);

  assert.equal(wordleInstance.$progress.options.text, 'Word 1/4');
  assert.deepEqual(counterMaxTries, [undefined, undefined, 6]);
  assert.equal(deferredCallbacks.length, 1);
  deferredCallbacks.shift()();
  assert.equal(resizeCount, 3);
});

test('first timer activation requests one deferred resize in every mode', function () {
  const modes = [
    { playMode: 'availableSentences', wordle: false },
    { playMode: 'availableSentences', wordle: true },
    { playMode: 'userSentence', wordle: false },
    { playMode: 'userSentence', wordle: true }
  ];

  modes.forEach(function (mode) {
    const deferredCallbacks = [];
    const timerEvents = [];
    const counterEvents = [];
    const sandbox = {
      GuessIt: function () {},
      $: function (tag, options) {
        return createElement(tag, options);
      },
      setTimeout: function (callback, delay) {
        assert.equal(delay, 0);
        deferredCallbacks.push(callback);
      }
    };
    sandbox.GuessIt.Timer = function () {
      this.play = function () { timerEvents.push('play'); };
    };
    sandbox.GuessIt.Counter = function () {
      this.increment = function () { counterEvents.push('increment'); };
    };
    vm.runInNewContext(
      getPrototypeMethodSource('initCounters', 'initTask'),
      sandbox
    );

    let resizeCount = 0;
    const instance = {
      $progressWrapper: createElement('progress-wrapper'),
      numQuestions: 2,
      params: {
        playMode: mode.playMode,
        round: 'Round @round',
        sentence: 'sentence',
        timeSpent: 'Time Spent',
        word: 'word',
        wordle: mode.wordle
      },
      trigger: function (eventName) {
        assert.equal(eventName, 'resize');
        resizeCount++;
      }
    };

    sandbox.GuessIt.prototype.initCounters.call(instance);

    assert.deepEqual(timerEvents, ['play'], JSON.stringify(mode));
    assert.deepEqual(counterEvents, ['increment'], JSON.stringify(mode));
    assert.equal(resizeCount, 0, JSON.stringify(mode));
    assert.equal(deferredCallbacks.length, 1, JSON.stringify(mode));
    deferredCallbacks[0]();
    assert.equal(resizeCount, 1, JSON.stringify(mode));
  });
});

test('incomplete warning clears only on completed answer input changes', function () {
  const sandbox = {
    GuessIt: function () {},
    WordleUtils: {
      normalizeInputLetter: function (value) { return value; }
    }
  };
  vm.runInNewContext(
    getPrototypeMethodSource(
      'showIncompleteAnswerWarning',
      'clearIncompleteAnswerWarning'
    ),
    sandbox
  );
  vm.runInNewContext(
    getPrototypeMethodSource(
      'clearIncompleteAnswerWarning',
      'showWordListValidationWarning'
    ),
    sandbox
  );

  [false, true].forEach(function (wordle) {
    const feedback = [];
    const field = {
      value: wordle ? 'É' : 'pasted answer',
      focus: function () {},
      val: function (value) {
        if (value !== undefined) {
          this.value = value;
          return this;
        }
        return this.value;
      }
    };
    const inputs = {
      length: 1,
      eq: function () { return field; },
      index: function () { return 0; }
    };
    const instance = Object.assign(Object.create(sandbox.GuessIt.prototype), {
      $questions: {
        eq: function () {
          return { find: function () { return inputs; } };
        }
      },
      currentSentenceId: 0,
      incompleteAnswerWarningVisible: false,
      params: {
        notFilledOut: 'Fill every blank',
        wordle
      },
      setFeedback: function () { feedback.push('set'); },
      updateFeedbackContent: function (message) { feedback.push(message); },
      clearWordListValidationWarning: function () {},
      wordListRejectedState: null
    });
    sandbox.self = instance;
    sandbox.$ = function (element) { return element; };
    const inputHandler = getAnswerInputHandler(sandbox);

    instance.showIncompleteAnswerWarning();
    assert.deepEqual(feedback, ['set', 'Fill every blank']);
    assert.equal(instance.incompleteAnswerWarningVisible, true);

    field.focus();
    assert.equal(instance.incompleteAnswerWarningVisible, true);
    assert.deepEqual(feedback, ['set', 'Fill every blank']);

    inputHandler.call(field, {
      originalEvent: { inputType: 'insertFromPaste' }
    });
    assert.equal(instance.incompleteAnswerWarningVisible, false);
    assert.deepEqual(feedback, ['set', 'Fill every blank', '']);

    instance.showIncompleteAnswerWarning();
    inputHandler.call(field, { originalEvent: { isComposing: true } });
    assert.equal(instance.incompleteAnswerWarningVisible, true);
    inputHandler.call(field, {});
    assert.equal(instance.incompleteAnswerWarningVisible, false);
    assert.equal(feedback.at(-1), '');

    feedback.push('Correct feedback');
    instance.clearIncompleteAnswerWarning();
    assert.equal(feedback.at(-1), 'Correct feedback');
  });
});

test('later attempts retain guarded timer and counter lifecycle', function () {
  const createQuestionsSource = getPrototypeMethodSource(
    'createQuestions',
    'autoGrowTextField'
  );
  const retrySource = getPrototypeMethodSource('reTry', 'newSentence');
  const initTaskSource = getPrototypeMethodSource('initTask', 'eventCompleted');
  const resetSource = getPrototypeMethodSource('resetTask', 'hideButtons');

  assert.match(
    createQuestionsSource,
    /if \(self\.\$timer === undefined\) \{\s+self\.initCounters\(\);\s+\}/
  );
  assert.doesNotMatch(retrySource, /initCounters/);
  assert.match(retrySource, /this\.timer\.play\(\);\s+this\.counter\.increment\(\);/);
  assert.match(
    initTaskSource,
    /this\.timer\.reset\(\);\s+this\.timer\.play\(\);\s+this\.counter\.reset\(\);/
  );
  assert.match(resetSource, /this\.timer = undefined;/);
  assert.match(resetSource, /this\.counter = undefined;/);
});

test('Sentence feedback sizing reuses auto-grow with no compact minimum', function () {
  const autoGrowSource = getPrototypeMethodSource(
    'autoGrowTextField',
    'resetGrowTextField'
  );
  const retrySource = getPrototypeMethodSource('reTry', 'newSentence');

  assert.match(
    autoGrowSource,
    /\.h5p-guessit-sentence-feedback,[\s\S]*\.h5p-guessit-sentence-preserved-correct[\s\S]*\)\.length > 0/
  );
  assert.match(autoGrowSource, /compactSentenceFeedback \? 0 : 3/);
  assert.match(autoGrowSource, /width \+ static_min_pad/);
  assert.match(
    retrySource,
    /cloze\.resetFeedbackPresentation\(\)[\s\S]*this\.resetGrowTextField\(\)/
  );
  assert.match(
    getPrototypeMethodSource('removeMarkedResults', 'showCorrectAnswers'),
    /h5p-guessit-sentence-preserved-correct/
  );
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
    clearIncompleteAnswerWarning: function () {},
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
