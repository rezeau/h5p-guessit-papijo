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
  itemCountChoicePending
) {
  if (playMode !== 'availableSentences') {
    return 'learner-supplied';
  }
  if (toQuestionArray(questionPool).length === 0) {
    return 'empty';
  }

  return itemCountChoicePending ? 'item-count-choice' : 'ready';
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

  const learnerQuestions = [question];
  instance.params.questions = learnerQuestions;
  instance.questionPool = learnerQuestions;
  instance.originalQuestions = learnerQuestions;
  instance.totalNumQuestions = 1;
  instance.selectedItemCount = 1;
  instance.selectedQuestionIndices = null;

  return question;
};

module.exports = {
  getConfiguredListState,
  getUsableQuestions,
  setLearnerQuestion,
  toQuestionArray
};
