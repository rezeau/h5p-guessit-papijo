'use strict';

const toQuestionArray = function (questions) {
  return Array.isArray(questions) ? questions : [];
};

/**
 * Normalize the plain text supplied by an H5P Sentence text field.
 *
 * H5P content can contain decimal or named apostrophe entities depending on
 * which editor/runtime serialized it. Decode only those known apostrophe
 * forms; Sentence content is plain text and must not be interpreted as HTML.
 *
 * @param {*} sentence Sentence field value.
 * @returns {*} Normalized sentence, or the original non-string value.
 */
const normalizeSentenceText = function (sentence) {
  if (typeof sentence !== 'string') {
    return sentence;
  }

  return sentence.replace(/(?:&#0?39;|&apos;)/g, "'");
};

/**
 * Normalize Sentence fields in a question array before runtime pools diverge.
 *
 * @param {object[]} questions Configured or restored questions.
 * @returns {object[]} The supplied question array.
 */
const normalizeSentenceQuestions = function (questions) {
  toQuestionArray(questions).forEach(function (question) {
    if (question && typeof question.sentence === 'string') {
      question.sentence = normalizeSentenceText(question.sentence);
    }
  });

  return toQuestionArray(questions);
};

const getUsableQuestions = function (questions, isWordleWord) {
  return toQuestionArray(questions).filter(function (question) {
    if (!question || typeof question.sentence !== 'string' ||
      question.sentence.trim() === '') {
      return false;
    }

    return !isWordleWord || isWordleWord(question.sentence);
  });
};

const getConfiguredListState = function (
  playMode,
  questionPool,
  itemCountChoicePending,
  wordLengthChoicePending
) {
  if (playMode !== 'availableSentences') {
    return 'learner-supplied';
  }
  if (toQuestionArray(questionPool).length === 0) {
    return 'empty';
  }

  if (itemCountChoicePending) {
    return 'item-count-choice';
  }
  return wordLengthChoicePending ? 'word-length-choice' : 'ready';
};

const getWordCountChoices = function (
  wordCounts,
  sentenceCounts,
  singularLabel,
  pluralLabel
) {
  const uniqueWordCounts = toQuestionArray(wordCounts).filter(function (
    wordCount,
    index,
    values
  ) {
    return values.indexOf(wordCount) === index;
  }).sort(function (a, b) {
    return a - b;
  });

  return uniqueWordCounts.map(function (wordCount) {
    const sentenceCount = sentenceCounts[wordCount];
    const sentenceLabel = sentenceCount > 1 ? pluralLabel : singularLabel;

    return {
      label: wordCount + ' [' + sentenceCount + ' ' + sentenceLabel + ']',
      sentenceCount,
      wordCount
    };
  });
};

const setLearnerQuestion = function (
  instance,
  sentence,
  tip,
  setTip
) {
  const questions = toQuestionArray(instance.params.questions);
  const question = questions[0] &&
    typeof questions[0] === 'object' ?
    questions[0] :
    {};

  question.sentence = sentence;
  if (setTip) {
    question.tip = tip;
  }
  question.ID = 0;

  const learnerQuestions = [question];
  instance.learnerQuestion = question;
  instance.params.questions = learnerQuestions;
  instance.questionPool = learnerQuestions;
  instance.activeQuestionPool = learnerQuestions;
  instance.originalQuestions = learnerQuestions;
  instance.totalNumQuestions = 1;
  instance.selectedItemCount = 1;
  instance.selectedQuestionIndices = null;

  return question;
};

module.exports = {
  getConfiguredListState,
  getUsableQuestions,
  getWordCountChoices,
  normalizeSentenceQuestions,
  normalizeSentenceText,
  setLearnerQuestion,
  toQuestionArray
};
