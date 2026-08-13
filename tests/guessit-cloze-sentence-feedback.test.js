'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const createElement = function (initialValue = '') {
  const attributes = {};
  const classes = new Set();
  const handlers = {};
  let value = initialValue;

  return {
    addClass: function (className) {
      classes.add(className);
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
    hasClass: function (className) {
      return classes.has(className);
    },
    is: function (selector) {
      return selector === ':disabled' && attributes.disabled === true;
    },
    offset: function () {
      return { left: 0, top: 0 };
    },
    on: function (eventName, handler) {
      handlers[eventName] = handler;
      return this;
    },
    removeClass: function (classNames) {
      classNames.split(' ').forEach(function (className) {
        classes.delete(className);
      });
      return this;
    },
    triggerInput: function () {
      if (handlers.input) {
        handlers.input({ originalEvent: {} });
      }
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

const jquery = function (selector, context) {
  if (selector === '<span>') {
    if (context.class === 'h5p-guessit-markup') {
      context.appendTo.markup = {
        ariaHidden: context['aria-hidden'],
        className: context.class,
        text: context.text
      };
    }
    return createElement();
  }

  return {
    remove: function () {
      if (context) {
        context.markup = null;
      }
    }
  };
};

global.H5P = {
  GuessIt: function () {},
  jQuery: jquery,
  trim: function (text) {
    return text.trim();
  }
};

delete require.cache[require.resolve('../src/scripts/guessit-cloze')];
require('../src/scripts/guessit-cloze');

const createCloze = function (target, learner, caseSensitive = true, wordle = false) {
  const wrapper = createElement();
  const input = createElement(learner);
  input.parent = function () {
    return wrapper;
  };

  const cloze = new H5P.GuessIt.Cloze(
    { solutions: [target] },
    { caseSensitive },
    '',
    wordle,
    {
      answeredCorrectly: 'Answered correctly',
      answeredIncorrectly: 'Answered incorrectly',
      inputLabel: 'Word @num of @total',
      solutionLabel: 'Correct answer:'
    }
  );
  cloze.setInput(input, undefined, undefined, 0, 1);

  return { cloze, input, wrapper };
};

const getState = function (harness) {
  if (harness.wrapper.hasClass('h5p-correct')) {
    return 'correct';
  }
  if (harness.wrapper.hasClass('feedback-neutral')) {
    return 'neutral';
  }
  if (harness.wrapper.hasClass('h5p-wrong')) {
    return 'incorrect';
  }
  return 'unanswered';
};

test('sentence feedback keeps full correctness authoritative', function () {
  const cases = [
    ['A', 'A', true, 'correct'],
    ['A', 'a', true, 'neutral'],
    ['A', 'a', false, 'correct'],
    ['rolling', 'roller', true, 'neutral'],
    ['stone', 'something', true, 'neutral'],
    ['stone', 'rock', true, 'incorrect']
  ];

  cases.forEach(function ([target, learner, caseSensitive, expected]) {
    const harness = createCloze(target, learner, caseSensitive);
    harness.cloze.checkAnswer();
    assert.equal(
      getState(harness),
      expected,
      `${target}/${learner}/${caseSensitive}`
    );
  });
});

test('mixed sentence receives correct, neutral, and incorrect states', function () {
  const target = ['A', 'rolling', 'stone', 'gathers', 'no', 'moss'];
  const learner = ['a', 'roller', 'rock', 'gathers', 'no', 'moss'];
  const states = target.map(function (word, index) {
    const harness = createCloze(word, learner[index], true);
    harness.cloze.checkAnswer();
    return getState(harness);
  });

  assert.deepEqual(
    states,
    ['neutral', 'neutral', 'incorrect', 'correct', 'correct', 'correct']
  );
});

test('neutral feedback has no correctness icon class or incorrect announcement', function () {
  const harness = createCloze('rolling', 'roller');
  harness.cloze.checkAnswer();

  assert.equal(harness.wrapper.hasClass('feedback-neutral'), true);
  assert.equal(harness.wrapper.hasClass('h5p-correct'), false);
  assert.equal(harness.wrapper.hasClass('h5p-wrong'), false);
  assert.equal(harness.cloze.correct(), false);
  assert.equal(harness.input.attr('aria-label'), 'Word 1 of 1');
  assert.doesNotMatch(harness.input.attr('aria-label'), /incorrect|correctly/i);
});

test('sentence hint markup stays intact for neutral and incorrect answers', function () {
  const neutral = createCloze('rolling', 'roller');
  neutral.cloze.checkAnswer();
  assert.deepEqual(neutral.wrapper.markup, {
    ariaHidden: true,
    className: 'h5p-guessit-markup',
    text: '====>'
  });

  const incorrect = createCloze('stone', 'rock');
  incorrect.cloze.checkAnswer();
  assert.deepEqual(incorrect.wrapper.markup, {
    ariaHidden: true,
    className: 'h5p-guessit-markup',
    text: '>'
  });
  assert.equal(incorrect.wrapper.hasClass('h5p-wrong'), true);
  assert.match(incorrect.input.attr('aria-label'), /Answered incorrectly/);
});

test('empty sentence input preserves existing incorrect unanswered behavior', function () {
  const harness = createCloze('stone', '');
  harness.cloze.checkAnswer();

  assert.equal(getState(harness), 'incorrect');
  assert.equal(harness.wrapper.markup, null);
  assert.equal(harness.input.attr('disabled'), undefined);
  assert.match(harness.input.attr('aria-label'), /Answered incorrectly/);
});

test('retry clears and re-enables neutral fields while preserving correct fields', function () {
  const neutral = createCloze('rolling', 'roller');
  const correct = createCloze('stone', 'stone');
  neutral.cloze.checkAnswer();
  correct.cloze.checkAnswer();

  assert.equal(neutral.input.attr('disabled'), true);
  neutral.cloze.resetBlank();
  neutral.cloze.setUserInput('');
  neutral.cloze.resetAriaLabel();
  neutral.cloze.enableInput();

  assert.equal(neutral.wrapper.hasClass('feedback-neutral'), false);
  assert.equal(neutral.wrapper.markup, null);
  assert.equal(neutral.input.val(), '');
  assert.equal(neutral.input.attr('disabled'), false);
  assert.equal(neutral.input.attr('aria-label'), 'Word 1 of 1');
  assert.equal(correct.input.val(), 'stone');
  assert.equal(correct.input.attr('disabled'), true);
  assert.equal(correct.wrapper.hasClass('h5p-correct'), true);
});

test('neutral answers remain unresolved and receive no score credit', function () {
  const correct = createCloze('A', 'A');
  const neutral = createCloze('rolling', 'roller');
  const incorrect = createCloze('stone', 'rock');
  const clozes = [correct.cloze, neutral.cloze, incorrect.cloze];

  assert.equal(clozes.filter(function (cloze) {
    return cloze.correct();
  }).length, 1);
  assert.equal(clozes.findIndex(function (cloze) {
    return !cloze.correct();
  }), 1);
});

test('neutral CSS uses current H5P variables and defines no feedback icon', function () {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'styles', 'guessit.css'),
    'utf8'
  );
  const neutralRule = css.match(
    /\.feedback-neutral \.h5p-text-input\s*\{([^}]+)\}/
  );

  assert.notEqual(neutralRule, null);
  assert.match(neutralRule[1], /var\(--h5p-theme-feedback-neutral-main\)/);
  assert.match(neutralRule[1], /var\(--h5p-theme-feedback-neutral-secondary\)/);
  assert.match(neutralRule[1], /var\(--h5p-theme-feedback-neutral-third\)/);
  assert.doesNotMatch(css, /\.feedback-neutral(?:::|:)after/);
  assert.match(css, /\.h5p-correct:after[\s\S]*content: "\\e903"/);
  assert.match(css, /\.h5p-wrong:after[\s\S]*content: "\\e902"/);
});

test('Wordle misplaced feedback remains on its existing isolated class', function () {
  const harness = createCloze('A', 'B', true, true);
  harness.cloze.checkAnswerWordle('misplaced');

  assert.equal(harness.wrapper.hasClass('h5p-misplaced'), true);
  assert.equal(harness.wrapper.hasClass('feedback-neutral'), false);
  assert.equal(harness.wrapper.hasClass('h5p-wrong'), false);
});
