const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const loadCounter = function () {
  const context = {
    H5P: {
      GuessIt: {}
    }
  };
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'scripts', 'guessit-counter.js'),
    'utf8'
  );
  vm.runInNewContext(source, context);
  return context.H5P.GuessIt.Counter;
};

const createCounter = function (maxTries) {
  const Counter = loadCounter();
  const element = { innerText: '' };
  const counter = new Counter([element], maxTries);
  counter.increment();
  return { counter, element };
};

test('configured Wordle displays its finite maximum and increments the round', function () {
  const sixTries = createCounter(6);
  assert.equal(sixTries.element.innerText, '1/6');
  sixTries.counter.increment();
  assert.equal(sixTries.element.innerText, '2/6');

  const eightTries = createCounter(8);
  assert.equal(eightTries.element.innerText, '1/8');
  eightTries.counter.increment();
  assert.equal(eightTries.element.innerText, '2/8');
});

test('learner-selected finite Wordle limits display their numeric value', function () {
  assert.equal(createCounter('6').element.innerText, '1/6');
  assert.equal(createCounter('8').element.innerText, '1/8');
});

test('learner-selected No limit never displays a denominator', function () {
  const noLimit = createCounter('No limit');
  assert.equal(noLimit.element.innerText, '1');
  noLimit.counter.increment();
  assert.equal(noLimit.element.innerText, '2');
  noLimit.counter.increment();
  assert.equal(noLimit.element.innerText, '3');
});

test('changing between finite and No limit leaves no stale denominator', function () {
  const element = { innerText: '' };
  const Counter = loadCounter();
  const finite = new Counter([element], '8');
  finite.increment();
  assert.equal(element.innerText, '1/8');

  const noLimit = new Counter([element], 'No limit');
  noLimit.increment();
  assert.equal(element.innerText, '1');
});

test('reset restores round one with the effective Wordle display', function () {
  const finite = createCounter(6);
  finite.counter.increment();
  finite.counter.reset();
  assert.equal(finite.element.innerText, '1/6');

  const noLimit = createCounter('No limit');
  noLimit.counter.increment();
  noLimit.counter.reset();
  assert.equal(noLimit.element.innerText, '1');
});

test('sentence mode keeps the existing current-round-only display', function () {
  const sentence = createCounter();
  assert.equal(sentence.element.innerText, '1');
  sentence.counter.increment();
  assert.equal(sentence.element.innerText, '2');
});

test('non-numeric and empty maximum values never leak into the display', function () {
  [undefined, null, '', 'undefined', 'null', Infinity].forEach(function (value) {
    assert.equal(createCounter(value).element.innerText, '1');
  });
});
