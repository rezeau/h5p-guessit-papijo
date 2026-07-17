'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WordleUtils = require('../src/scripts/guessit-wordle-utils');

test('accepts unaccented equivalents and preserves canonical accents', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('ÉTÉ', 'ETE'),
    ['correct', 'correct', 'correct']
  );
  assert.equal(WordleUtils.normalizeCanonicalWord('E\u0301TE\u0301'), 'ÉTÉ');
});

test('calculates mixed correct and wrong letters using folded accents', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('ÉTAGE', 'ETAPE'),
    ['correct', 'correct', 'correct', 'wrong', 'correct']
  );
});

test('consumes repeated normalized letters only once', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('ÉLEVÉ', 'EEEEE'),
    ['correct', 'wrong', 'correct', 'wrong', 'correct']
  );
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('ÉLEVÉ', 'ELEVE'),
    ['correct', 'correct', 'correct', 'correct', 'correct']
  );
});

test('accepts cedilla equivalents', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('GARÇON', 'GARCON'),
    ['correct', 'correct', 'correct', 'correct', 'correct', 'correct']
  );
});

test('accepts Western European accent equivalents', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('ÁRVORE', 'ARVORE'),
    ['correct', 'correct', 'correct', 'correct', 'correct', 'correct']
  );
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('MAÑANA', 'MANANA'),
    ['correct', 'correct', 'correct', 'correct', 'correct', 'correct']
  );
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('FJØRD', 'FJORD'),
    ['correct', 'correct', 'correct', 'correct', 'correct']
  );
});

test('accepts direct accented, lowercase, and decomposed learner input', function () {
  assert.equal(WordleUtils.normalizeInputLetter('É'), 'É');
  assert.equal(WordleUtils.normalizeInputLetter('é'), 'É');
  assert.equal(WordleUtils.normalizeInputLetter('E\u0301'), 'É');
  assert.equal(WordleUtils.normalizeInputLetter('á'), 'Á');
  assert.equal(WordleUtils.normalizeInputLetter('ñ'), 'Ñ');
  assert.equal(WordleUtils.normalizeInputLetter('ø'), 'Ø');
  assert.equal(WordleUtils.normalizeInputLetter('1'), '');
  assert.equal(WordleUtils.normalizeInputLetter('ET'), '');
});

test('keeps ligatures as single, unexpanded letters', function () {
  assert.equal(WordleUtils.toWordleLetters('ŒUVRE').length, 5);
  assert.equal(WordleUtils.normalizeForComparison('Œ'), 'Œ');
  assert.equal(WordleUtils.normalizeForComparison('Æ'), 'Æ');
  assert.notEqual(WordleUtils.normalizeForComparison('Œ'), 'OE');
  assert.notEqual(WordleUtils.normalizeForComparison('Æ'), 'AE');
});

test('folds crossed O without expanding ligatures', function () {
  assert.equal(WordleUtils.normalizeForComparison('Ø'), 'O');
  assert.equal(WordleUtils.normalizeForComparison('ø'), 'O');
  assert.equal(WordleUtils.normalizeForComparison('Æ'), 'Æ');
  assert.equal(WordleUtils.normalizeForComparison('Œ'), 'Œ');
});

test('validates four to eight Western European letters after NFC normalization', function () {
  assert.equal(WordleUtils.isValidWordleWord('ÉTÉE'), true);
  assert.equal(WordleUtils.isValidWordleWord('GARÇON'), true);
  assert.equal(WordleUtils.isValidWordleWord('ŒUVRE'), true);
  assert.equal(WordleUtils.isValidWordleWord('ÁRVORE'), true);
  assert.equal(WordleUtils.isValidWordleWord('FJØRD'), true);
  assert.equal(WordleUtils.isValidWordleWord('ETE'), false);
  assert.equal(WordleUtils.isValidWordleWord('MOT-DEUX'), false);
});

test('normalizes canonical words from previous-state data', function () {
  const previousState = {
    originalQuestions: [{ sentence: 'E\u0301TE\u0301' }]
  };
  previousState.originalQuestions.forEach(function (question) {
    question.sentence = WordleUtils.normalizeCanonicalWord(question.sentence);
  });

  assert.equal(previousState.originalQuestions[0].sentence, 'ÉTÉ');
});

test('preserves existing unaccented English Wordle scoring', function () {
  assert.deepEqual(
    WordleUtils.evaluateWordleGuess('APPLE', 'ALLEY'),
    ['correct', 'misplaced', 'wrong', 'misplaced', 'wrong']
  );
});

test('author semantics accept uppercase and lowercase Western European words', function () {
  const semantics = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'semantics.json'),
    'utf8'
  ));
  const questions = semantics.find(function (field) {
    return field.name === 'questionsW';
  });
  const sentence = questions.field.fields.find(function (field) {
    return field.name === 'sentence';
  });
  const pattern = new RegExp(sentence.regexp.pattern);

  assert.equal(pattern.test('ÉTAGE'), true);
  assert.equal(pattern.test('GARÇON'), true);
  assert.equal(pattern.test('ŒUVRE'), true);
  assert.equal(pattern.test('étage'), true);
  assert.equal(pattern.test('garçon'), true);
  assert.equal(pattern.test('œuvre'), true);
  assert.equal(pattern.test('ÁRVORE'), true);
  assert.equal(pattern.test('árvore'), true);
  assert.equal(pattern.test('MAÑANA'), true);
  assert.equal(pattern.test('mañana'), true);
  assert.equal(pattern.test('FJØRD'), true);
  assert.equal(pattern.test('fjørd'), true);
  assert.equal(pattern.test('WORD'), true);
  assert.equal(pattern.test('word'), true);
  assert.equal(pattern.test('MOT-DEUX'), false);
});
