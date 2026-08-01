'use strict';
/* global Map, Set */

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

/**
 * Get the Unicode code-point length of a valid Wordle word.
 *
 * @param {*} word Candidate word.
 * @returns {number|null} Word length or null when the word is unusable.
 */
const getWordleWordLength = function (word) {
  if (typeof word !== 'string' || !isValidWordleWord(word)) {
    return null;
  }

  return Array.from(normalizeCanonicalWord(word)).length;
};

/**
 * Group usable Wordle questions by Unicode code-point length.
 * Questions retain their source order and are not cloned or mutated.
 *
 * @param {*} questions Candidate question list.
 * @returns {Map<number, Array>} Questions grouped by word length.
 */
const groupWordleQuestionsByLength = function (questions) {
  const groups = new Map();
  if (!Array.isArray(questions)) {
    return groups;
  }

  questions.forEach(function (question) {
    if (!question || typeof question.sentence !== 'string') {
      return;
    }

    const length = getWordleWordLength(question.sentence);
    if (length === null) {
      return;
    }

    if (!groups.has(length)) {
      groups.set(length, []);
    }
    groups.get(length).push(question);
  });

  return groups;
};

const isWordLengthSelectionApplicable = function (
  params,
  itemCountChoiceEnabled
) {
  return Boolean(
    params &&
    params.wordle &&
    params.playMode === 'availableSentences' &&
    params.behaviour &&
    params.behaviour.enableWordLengthChoice === true &&
    !itemCountChoiceEnabled
  );
};

const isWordLengthChoiceEnabled = function (
  params,
  itemCountChoiceEnabled,
  availableLengthCount
) {
  return isWordLengthSelectionApplicable(params, itemCountChoiceEnabled) &&
    availableLengthCount > 1;
};

const createAcceptedWordSet = function (questions) {
  const acceptedWordSet = new Set();
  if (!Array.isArray(questions)) {
    return acceptedWordSet;
  }

  questions.forEach(function (question) {
    if (!question || typeof question.sentence !== 'string') {
      return;
    }

    const word = question.sentence.trim();
    if (!word || !isValidWordleWord(word)) {
      return;
    }

    acceptedWordSet.add(normalizeForComparison(word));
  });

  return acceptedWordSet;
};

const isAcceptedWord = function (word, acceptedWordSet) {
  if (typeof word !== 'string' || !(acceptedWordSet instanceof Set)) {
    return false;
  }

  const trimmedWord = word.trim();
  return trimmedWord !== '' &&
    acceptedWordSet.has(normalizeForComparison(trimmedWord));
};

const isWordListValidationEnabled = function (params) {
  return Boolean(
    params &&
    params.wordle &&
    params.playMode === 'availableSentences' &&
    params.behaviour &&
    params.behaviour.enableWordListValidation === true
  );
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
  createAcceptedWordSet,
  evaluateWordleGuess,
  getWordleWordLength,
  groupWordleQuestionsByLength,
  isAcceptedWord,
  isValidWordleWord,
  isWordLengthChoiceEnabled,
  isWordLengthSelectionApplicable,
  isWordListValidationEnabled,
  normalizeCanonical,
  normalizeCanonicalWord,
  normalizeForComparison,
  normalizeInputLetter,
  toWordleLetters
};
