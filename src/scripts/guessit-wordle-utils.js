'use strict';

const WESTERN_EUROPEAN_LETTER_PATTERN = /^[A-Za-zÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝŸŒàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿœ]$/;

const normalizeCanonical = function (text) {
  return String(text ?? '').normalize('NFC');
};

const normalizeCanonicalWord = function (text) {
  return normalizeCanonical(text).toLocaleUpperCase('fr-FR');
};

const normalizeForComparison = function (text) {
  return normalizeCanonical(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('fr-FR')
    .replace(/Ø/g, 'O')
    .normalize('NFC');
};

const toWordleLetters = function (text) {
  return Array.from(normalizeCanonical(text));
};

const normalizeInputLetter = function (text) {
  const letters = toWordleLetters(text);
  if (letters.length !== 1 || !WESTERN_EUROPEAN_LETTER_PATTERN.test(letters[0])) {
    return '';
  }

  return normalizeCanonicalWord(letters[0]);
};

const isValidWordleWord = function (text) {
  const letters = toWordleLetters(normalizeCanonicalWord(text));
  return letters.length >= 4 && letters.length <= 8 &&
    letters.every(function (letter) {
      return WESTERN_EUROPEAN_LETTER_PATTERN.test(letter);
    });
};

const evaluateWordleGuess = function (canonicalAnswer, learnerGuess) {
  const answerLetters = toWordleLetters(canonicalAnswer);
  const guessLetters = toWordleLetters(learnerGuess);
  const comparisonAnswer = answerLetters.map(normalizeForComparison);
  const comparisonGuess = guessLetters.map(normalizeForComparison);
  const states = answerLetters.map(function () {
    return 'wrong';
  });
  const remainingLetters = Object.create(null);

  comparisonAnswer.forEach(function (answerLetter, index) {
    if (answerLetter === comparisonGuess[index]) {
      states[index] = 'correct';
      return;
    }

    remainingLetters[answerLetter] = (remainingLetters[answerLetter] || 0) + 1;
  });

  comparisonGuess.forEach(function (guessedLetter, index) {
    if (states[index] === 'correct' || !remainingLetters[guessedLetter]) {
      return;
    }

    states[index] = 'misplaced';
    remainingLetters[guessedLetter]--;
  });

  return states;
};

module.exports = {
  evaluateWordleGuess,
  isValidWordleWord,
  normalizeCanonical,
  normalizeCanonicalWord,
  normalizeForComparison,
  normalizeInputLetter,
  toWordleLetters
};
