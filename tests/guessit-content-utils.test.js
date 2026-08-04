'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ContentUtils = require('../src/scripts/guessit-content-utils');
const WordleUtils = require('../src/scripts/guessit-wordle-utils');
const QuestionSelector = require('../src/scripts/guessit-question-selector');

const createInstance = function (questions) {
  return {
    activeQuestionPool: [],
    learnerQuestion: null,
    originalQuestions: [],
    params: {
      questions
    },
    questionPool: [],
    selectedItemCount: 0,
    selectedQuestionIndices: [4],
    totalNumQuestions: 0
  };
};

const countWords = function (sentence) {
  return sentence.trim().split(/\s+/).length;
};

const simulateConfiguredSentenceFlow = function (options) {
  const pool = ContentUtils.getUsableQuestions(options.questions);
  const itemCountChoiceEnabled = options.enableItemCountChoice &&
    pool.length > 1;
  const numberOfWordsChoiceEnabled = options.enableNumChoice &&
    !itemCountChoiceEnabled;
  let activeQuestions = itemCountChoiceEnabled ?
    [] :
    QuestionSelector.selectForGame(pool, options.order).items;
  let itemCountChoicePending = itemCountChoiceEnabled;
  let initializationCount = 0;
  const screens = [];

  let state = ContentUtils.getConfiguredListState(
    'availableSentences',
    pool,
    itemCountChoicePending
  );
  if (state === 'empty') {
    return {
      activeQuestions,
      initializationCount,
      noItemsWarning: true,
      pool,
      screens
    };
  }

  if (state === 'item-count-choice') {
    screens.push('item-count-choice');
    const selection = options.order === 'normal' ?
      QuestionSelector.selectFirst(pool, options.requestedItems) :
      QuestionSelector.selectSubset(
        pool,
        options.requestedItems,
        options.random
      );
    activeQuestions = selection.items;
    itemCountChoicePending = false;
    state = ContentUtils.getConfiguredListState(
      'availableSentences',
      pool,
      itemCountChoicePending
    );
  }

  let numQuestions = activeQuestions.length;
  if (state === 'ready' && numberOfWordsChoiceEnabled) {
    const wordCounts = new Set(activeQuestions.map(function (question) {
      return countWords(question.sentence);
    }));
    if (wordCounts.size > 1) {
      screens.push('word-count-choice');
      numQuestions = activeQuestions.filter(function (question) {
        return countWords(question.sentence) === options.requestedWords;
      }).length;
    }
  }

  if (state === 'ready') {
    initializationCount++;
  }

  return {
    activeQuestions,
    initializationCount,
    maxScore: numQuestions,
    noItemsWarning: false,
    numQuestions,
    pool,
    progressTotal: numQuestions,
    screens
  };
};

test('creates a learner sentence when the configured list is empty', function () {
  const instance = createInstance([]);

  const question = ContentUtils.setLearnerQuestion(
    instance,
    'A learner sentence',
    'A useful tip',
    true
  );

  assert.deepEqual(question, {
    ID: 0,
    sentence: 'A learner sentence',
    tip: 'A useful tip'
  });
  assert.equal(instance.params.questions.length, 1);
  assert.equal(instance.params.questions, instance.questionPool);
  assert.equal(instance.params.questions, instance.activeQuestionPool);
  assert.equal(instance.params.questions, instance.originalQuestions);
  assert.equal(instance.learnerQuestion, question);
  assert.equal(instance.totalNumQuestions, 1);
  assert.equal(instance.selectedItemCount, 1);
  assert.equal(instance.selectedQuestionIndices, null);
});

test('sorts single- and double-digit word-count choices numerically', function () {
  const counts = {
    4: 4,
    5: 3,
    6: 5,
    7: 4,
    8: 2,
    10: 1,
    11: 1
  };
  const choices = ContentUtils.getWordCountChoices(
    [4, 5, 6, 7, 8, 10, 11, 4, 6],
    counts,
    'translated sentence',
    'translated sentences'
  );

  assert.deepEqual(choices.map(function (choice) {
    return choice.wordCount;
  }), [4, 5, 6, 7, 8, 10, 11]);
  assert.deepEqual(choices.map(function (choice) {
    return choice.label;
  }), [
    '4 [4 translated sentences]',
    '5 [3 translated sentences]',
    '6 [5 translated sentences]',
    '7 [4 translated sentences]',
    '8 [2 translated sentences]',
    '10 [1 translated sentence]',
    '11 [1 translated sentence]'
  ]);
});

test('keeps a single numeric word-count choice unchanged', function () {
  assert.deepEqual(ContentUtils.getWordCountChoices(
    [10, 10],
    { 10: 2 },
    'sentence',
    'sentences'
  ), [{
    label: '10 [2 sentences]',
    sentenceCount: 2,
    wordCount: 10
  }]);
});

test('number-of-words selection remains bypassed when disabled', function () {
  const result = simulateConfiguredSentenceFlow({
    enableItemCountChoice: false,
    enableNumChoice: false,
    order: 'normal',
    questions: [
      { sentence: 'Four words appear right here' },
      { sentence: 'This sentence contains more than ten separate words for testing today' }
    ]
  });

  assert.deepEqual(result.screens, []);
  assert.equal(result.initializationCount, 1);
  assert.equal(result.numQuestions, 2);
});

test('reset learner input establishes a new authoritative question', function () {
  const instance = createInstance([]);
  const firstQuestion = ContentUtils.setLearnerQuestion(
    instance,
    'FIRST',
    undefined,
    false
  );

  instance.params.questions = [];
  instance.questionPool = [];
  instance.activeQuestionPool = [];
  instance.originalQuestions = [];
  instance.learnerQuestion = null;

  const retryQuestion = ContentUtils.setLearnerQuestion(
    instance,
    'SECOND',
    undefined,
    false
  );

  assert.notEqual(retryQuestion, firstQuestion);
  assert.deepEqual(retryQuestion, { ID: 0, sentence: 'SECOND' });
  assert.equal(instance.params.questions, instance.questionPool);
  assert.equal(instance.params.questions, instance.activeQuestionPool);
  assert.equal(instance.params.questions, instance.originalQuestions);
});

test('creates a learner Wordle word when the configured list is empty', function () {
  const instance = createInstance([]);

  ContentUtils.setLearnerQuestion(
    instance,
    'PRÉCÉDER',
    undefined,
    false
  );

  assert.deepEqual(instance.params.questions, [
    { ID: 0, sentence: 'PRÉCÉDER' }
  ]);
});

test('preserves an existing placeholder and sentence tip behaviour', function () {
  const placeholder = {
    audio: [{ path: 'audio/example.mp3' }],
    sentence: 'Placeholder',
    tip: 'Old tip'
  };
  const instance = createInstance([
    placeholder,
    { sentence: 'Unused second item' }
  ]);

  const question = ContentUtils.setLearnerQuestion(
    instance,
    'Replacement sentence',
    'Replacement tip',
    true
  );

  assert.equal(question, placeholder);
  assert.equal(question.sentence, 'Replacement sentence');
  assert.equal(question.tip, 'Replacement tip');
  assert.deepEqual(question.audio, [{ path: 'audio/example.mp3' }]);
  assert.equal(instance.params.questions.length, 1);
});

test('preserves existing Wordle placeholder metadata', function () {
  const placeholder = {
    sentence: 'APPLE',
    tip: 'Existing author tip'
  };
  const instance = createInstance([placeholder]);

  ContentUtils.setLearnerQuestion(
    instance,
    'PRÉCÉDER',
    undefined,
    false
  );

  assert.equal(instance.params.questions[0], placeholder);
  assert.equal(instance.params.questions[0].sentence, 'PRÉCÉDER');
  assert.equal(
    instance.params.questions[0].tip,
    'Existing author tip'
  );
});

test('malformed or missing question arrays are normalized safely', function () {
  [undefined, null, {}, 'not-an-array'].forEach(function (questions) {
    assert.deepEqual(ContentUtils.toQuestionArray(questions), []);

    const instance = createInstance(questions);
    assert.doesNotThrow(function () {
      ContentUtils.setLearnerQuestion(
        instance,
        'Safe learner sentence',
        undefined,
        false
      );
    });
  });
});

test('available-list filtering keeps only usable configured content', function () {
  const sentenceQuestions = ContentUtils.getUsableQuestions([
    {},
    { sentence: '' },
    { sentence: '   ' },
    { sentence: 'Usable sentence' }
  ]);
  assert.deepEqual(sentenceQuestions, [
    { sentence: 'Usable sentence' }
  ]);

  const wordQuestions = ContentUtils.getUsableQuestions([
    { sentence: '' },
    { sentence: 'CAT' },
    { sentence: 'PRÉCÉDER' },
    { sentence: 'WORD' }
  ], WordleUtils.isValidWordleWord);
  assert.deepEqual(wordQuestions, [
    { sentence: 'PRÉCÉDER' },
    { sentence: 'WORD' }
  ]);
  assert.deepEqual(
    ContentUtils.getUsableQuestions(undefined),
    []
  );
});

test('configured-list state uses the complete pool while item selection is pending', function () {
  const pool = ContentUtils.getUsableQuestions([
    { sentence: 'First usable sentence' },
    { sentence: 'Second usable sentence' },
    { sentence: 'Third usable sentence' }
  ]);

  [false, true].forEach(function (enableNumChoice) {
    [false, true].forEach(function (enableItemCountChoice) {
      const activeQuestions = enableItemCountChoice ? [] : pool;
      const state = ContentUtils.getConfiguredListState(
        'availableSentences',
        pool,
        enableItemCountChoice
      );

      assert.notEqual(state, 'empty', {
        enableItemCountChoice,
        enableNumChoice
      });
      assert.equal(
        state,
        enableItemCountChoice ? 'item-count-choice' : 'ready'
      );
      assert.equal(
        activeQuestions.length,
        enableItemCountChoice ? 0 : pool.length
      );
    });
  });
});

test('configured-list selection respects requested counts and ordering', function () {
  const pool = ContentUtils.getUsableQuestions([
    { sentence: 'One short sentence' },
    { sentence: 'This sentence has four words' },
    { sentence: 'Another short sentence' },
    { sentence: 'This sentence also has five words' }
  ]);
  const firstTwo = QuestionSelector.selectFirst(pool, 2);
  const all = QuestionSelector.selectFirst(pool, pool.length);
  const randomTwo = QuestionSelector.selectSubset(
    pool,
    2,
    function () {
      return 0.75;
    }
  );

  assert.equal(firstTwo.items.length, 2);
  assert.deepEqual(firstTwo.indices, [0, 1]);
  assert.equal(all.items.length, pool.length);
  assert.equal(randomTwo.items.length, 2);
  assert.equal(new Set(randomTwo.indices).size, 2);
  assert.equal(pool.length, 4);
});

test('configured-list state is independent of sentence word-count distribution', function () {
  const sameWordCount = ContentUtils.getUsableQuestions([
    { sentence: 'First valid sentence' },
    { sentence: 'Second valid sentence' }
  ]);
  const differentWordCounts = ContentUtils.getUsableQuestions([
    { sentence: 'Short sentence' },
    { sentence: 'This is a longer sentence' }
  ]);

  [sameWordCount, differentWordCounts].forEach(function (pool) {
    assert.equal(
      ContentUtils.getConfiguredListState(
        'availableSentences',
        pool,
        false
      ),
      'ready'
    );
    assert.equal(
      ContentUtils.getConfiguredListState(
        'availableSentences',
        pool,
        true
      ),
      'item-count-choice'
    );
  });
});

test('configured sentence initialization regression matrix starts exactly once', function () {
  const questions = [
    { sentence: 'First short sentence' },
    { sentence: 'This sentence contains exactly five words' },
    { sentence: 'Another short sentence' },
    { sentence: 'This other sentence also has six words' }
  ];
  const cases = [
    {
      enableItemCountChoice: false,
      enableNumChoice: false,
      expectedScreens: [],
      expectedTotal: 4
    },
    {
      enableItemCountChoice: true,
      enableNumChoice: false,
      expectedScreens: ['item-count-choice'],
      expectedTotal: 2
    },
    {
      enableItemCountChoice: false,
      enableNumChoice: true,
      expectedScreens: ['word-count-choice'],
      expectedTotal: 2
    },
    {
      enableItemCountChoice: true,
      enableNumChoice: true,
      expectedScreens: ['item-count-choice'],
      expectedTotal: 2
    }
  ];

  cases.forEach(function (settings) {
    const result = simulateConfiguredSentenceFlow({
      enableItemCountChoice: settings.enableItemCountChoice,
      enableNumChoice: settings.enableNumChoice,
      order: 'normal',
      questions,
      requestedItems: 2,
      requestedWords: 3
    });

    assert.equal(result.noItemsWarning, false, settings);
    assert.deepEqual(result.screens, settings.expectedScreens, settings);
    assert.equal(result.initializationCount, 1, settings);
    assert.equal(result.pool.length, questions.length, settings);
    assert.equal(result.numQuestions, settings.expectedTotal, settings);
    assert.equal(result.progressTotal, settings.expectedTotal, settings);
    assert.equal(result.maxScore, settings.expectedTotal, settings);
  });
});

test('same word counts skip the redundant word-count screen', function () {
  const result = simulateConfiguredSentenceFlow({
    enableItemCountChoice: false,
    enableNumChoice: true,
    order: 'normal',
    questions: [
      { sentence: 'First valid sentence' },
      { sentence: 'Second valid sentence' }
    ],
    requestedWords: 3
  });

  assert.deepEqual(result.screens, []);
  assert.equal(result.initializationCount, 1);
  assert.equal(result.numQuestions, 2);
});

test('selected item count can equal the pool and random order keeps the pool intact', function () {
  const questions = [
    { sentence: 'Sentence number one' },
    { sentence: 'Sentence number two' },
    { sentence: 'Sentence number three' },
    { sentence: 'Sentence number four' }
  ];
  const all = simulateConfiguredSentenceFlow({
    enableItemCountChoice: true,
    enableNumChoice: false,
    order: 'normal',
    questions,
    requestedItems: questions.length
  });
  const randomSubset = simulateConfiguredSentenceFlow({
    enableItemCountChoice: true,
    enableNumChoice: false,
    order: 'random',
    questions,
    random: function () {
      return 0.75;
    },
    requestedItems: 2
  });

  assert.equal(all.activeQuestions.length, questions.length);
  assert.equal(all.numQuestions, questions.length);
  assert.equal(randomSubset.activeQuestions.length, 2);
  assert.deepEqual(
    randomSubset.activeQuestions.map(function (question) {
      return question.sentence;
    }),
    ['Sentence number three', 'Sentence number four']
  );
  assert.equal(randomSubset.pool.length, questions.length);
  assert.equal(randomSubset.initializationCount, 1);
});

test('only genuinely empty configured pools produce the empty state', function () {
  const emptyPool = ContentUtils.getUsableQuestions([]);
  const unusablePool = ContentUtils.getUsableQuestions([
    {},
    { sentence: '' },
    { sentence: '   ' }
  ]);

  [emptyPool, unusablePool].forEach(function (pool) {
    assert.equal(
      ContentUtils.getConfiguredListState(
        'availableSentences',
        pool,
        false
      ),
      'empty'
    );
    assert.equal(
      ContentUtils.getConfiguredListState(
        'availableSentences',
        pool,
        true
      ),
      'empty'
    );
  });
});

test('genuinely empty and unusable configured lists do not initialize', function () {
  [[], [{}, { sentence: '' }, { sentence: '   ' }]]
    .forEach(function (questions) {
      const result = simulateConfiguredSentenceFlow({
        enableItemCountChoice: true,
        enableNumChoice: true,
        order: 'normal',
        questions,
        requestedItems: 1
      });

      assert.equal(result.noItemsWarning, true);
      assert.equal(result.initializationCount, 0);
      assert.deepEqual(result.screens, []);
    });
});

test('learner-supplied mode never depends on a configured pool', function () {
  assert.equal(
    ContentUtils.getConfiguredListState('userSentence', [], false),
    'learner-supplied'
  );
  assert.equal(
    ContentUtils.getConfiguredListState('userSentence', undefined, true),
    'learner-supplied'
  );
});

test('runtime derives the no-items warning from the configured pool', function () {
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

  assert.match(
    source,
    /getConfiguredListState\(\s*this\.params\.playMode,\s*this\.configuredQuestionPool,\s*this\.itemCountChoicePending,\s*this\.wordLengthChoicePending/
  );
  assert.match(
    source,
    /configuredListState === 'empty'/
  );
  assert.match(
    source,
    /configuredListState === 'item-count-choice'/
  );
  assert.match(
    source,
    /configuredListState === 'word-length-choice'/
  );
  assert.match(
    source,
    /'role': 'alert'/
  );
  assert.match(
    source,
    /self\.params\.noQuestionsAvailable/
  );
});
