'use strict';

const toQuestionArray = function (questions) {
  return Array.isArray(questions) ? questions : [];
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
  setLearnerQuestion,
  toQuestionArray
};
