'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const createElement = function (initialValue) {
  const attributes = {};
  const classes = [];
  let value = initialValue;

  return {
    addClass: function (className) {
      if (!classes.includes(className)) {
        classes.push(className);
      }
      return this;
    },
    attr: function (name, attributeValue) {
      if (attributeValue === undefined) {
        return attributes[name];
      }
      attributes[name] = attributeValue;
      return this;
    },
    classes,
    on: function () {
      return this;
    },
    val: function (newValue) {
      if (newValue === undefined) {
        return value;
      }
      value = newValue;
      return this;
    }
  };
};

test('a correct unaccented cell is replaced with its canonical accent', function () {
  global.H5P = {
    GuessIt: function () {},
    jQuery: function () {},
    trim: function (text) {
      return text.trim();
    }
  };

  delete require.cache[require.resolve('../src/scripts/guessit-cloze')];
  require('../src/scripts/guessit-cloze');

  const wrapper = createElement('');
  const input = createElement('E');
  input.parent = function () {
    return wrapper;
  };

  const cloze = new H5P.GuessIt.Cloze(
    { solutions: ['É'] },
    { caseSensitive: false },
    '',
    true,
    {
      answeredCorrectly: 'Answered correctly',
      answeredIncorrectly: 'Answered incorrectly',
      inputLabel: 'Letter @num of @total',
      solutionLabel: 'Correct answer:'
    }
  );

  cloze.setInput(input, undefined, undefined, 0, 1);
  assert.equal(cloze.correct(), true);
  cloze.checkAnswerWordle('correct');

  assert.equal(input.val(), 'É');
  assert.equal(input.attr('disabled'), true);
  assert.equal(wrapper.classes.includes('h5p-correct-wordle'), true);
});
