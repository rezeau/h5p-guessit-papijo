'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ContentUtils = require('../src/scripts/guessit-content-utils');
const WordleUtils = require('../src/scripts/guessit-wordle-utils');

const createInstance = function (questions) {
  return {
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

test('creates a learner sentence when the configured list is empty', function () {
  const instance = createInstance([]);

  const question = ContentUtils.setLearnerQuestion(
    instance,
    'A learner sentence',
    'A useful tip',
    true
  );

  assert.deepEqual(question, {
    sentence: 'A learner sentence',
    tip: 'A useful tip'
  });
  assert.equal(instance.params.questions.length, 1);
  assert.equal(instance.params.questions, instance.questionPool);
  assert.equal(instance.params.questions, instance.originalQuestions);
  assert.equal(instance.totalNumQuestions, 1);
  assert.equal(instance.selectedItemCount, 1);
  assert.equal(instance.selectedQuestionIndices, null);
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
    { sentence: 'PRÉCÉDER' }
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

test('runtime handles an empty active list with an alert instead of starting', function () {
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
    /params\.questions\.length === 0/
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
