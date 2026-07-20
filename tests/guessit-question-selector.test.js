'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const QuestionSelector = require('../src/scripts/guessit-question-selector');

const createRandom = function (values) {
  let index = 0;
  return function () {
    const value = values[index % values.length];
    index++;
    return value;
  };
};

test('selects the requested number of unique source indices', function () {
  const indices = QuestionSelector.sampleIndices(
    10000,
    20,
    createRandom([0.1, 0.9, 0.3, 0.7])
  );

  assert.equal(indices.length, 20);
  const uniqueIndices = Object.create(null);
  indices.forEach(function (index) {
    uniqueIndices[index] = true;
  });
  assert.equal(Object.keys(uniqueIndices).length, 20);
  assert.equal(indices.every(function (index) {
    return index >= 0 && index < 10000;
  }), true);
  assert.deepEqual(indices, indices.slice().sort(function (a, b) {
    return a - b;
  }));
});

test('does not mutate the source pool', function () {
  const questions = Array.from({ length: 100 }, function (value, index) {
    return { sentence: `Question ${index}` };
  });
  const original = questions.slice();
  const selection = QuestionSelector.selectSubset(
    questions,
    10,
    createRandom([0.2, 0.8])
  );

  assert.equal(selection.items.length, 10);
  assert.deepEqual(questions, original);
  selection.items.forEach(function (question, index) {
    assert.equal(question, questions[selection.indices[index]]);
  });
});

test('selects the first items when author order must be preserved', function () {
  const questions = ['zero', 'one', 'two', 'three'];
  const selection = QuestionSelector.selectFirst(questions, 2);

  assert.deepEqual(selection.indices, [0, 1]);
  assert.deepEqual(selection.items, ['zero', 'one']);
  assert.deepEqual(questions, ['zero', 'one', 'two', 'three']);
});

test('accesses only selected items from a large pool', function () {
  const questions = Array.from({ length: 10000 }, function (value, index) {
    return { sentence: `Question ${index}` };
  });
  let itemReads = 0;
  const proxiedQuestions = new global.Proxy(questions, {
    get: function (target, property, receiver) {
      if (/^\d+$/.test(String(property))) {
        itemReads++;
      }
      return global.Reflect.get(target, property, receiver);
    }
  });

  const selection = QuestionSelector.selectSubset(
    proxiedQuestions,
    25,
    createRandom([0.05, 0.95, 0.4, 0.6])
  );

  assert.equal(selection.items.length, 25);
  assert.equal(itemReads, 25);
});

test('returns every item when the requested count reaches the pool size', function () {
  assert.deepEqual(
    QuestionSelector.sampleIndices(4, 10, createRandom([0.5])),
    [0, 1, 2, 3]
  );
});

test('restores the exact saved subset and ignores stale indices', function () {
  const questions = ['zero', 'one', 'two', 'three', 'four'];
  const restored = QuestionSelector.selectByIndices(
    questions,
    [1, 3, 99, -1]
  );

  assert.deepEqual(restored.indices, [1, 3]);
  assert.deepEqual(restored.items, ['one', 'three']);
});

test('rejects restored selections that bypass the safe item limit', function () {
  assert.equal(QuestionSelector.isSelectionWithinLimit([0]), true);
  assert.equal(QuestionSelector.isSelectionWithinLimit(
    Array.from({ length: 20 }, function (value, index) {
      return index;
    })
  ), true);
  assert.equal(QuestionSelector.isSelectionWithinLimit(
    Array.from({ length: 21 }, function (value, index) {
      return index;
    })
  ), false);
  assert.equal(QuestionSelector.isSelectionWithinLimit([]), false);
});

test('builds compact quantity choices ending with the complete pool', function () {
  assert.deepEqual(QuestionSelector.getCountChoices(3), [1, 2, 3]);
  assert.deepEqual(QuestionSelector.getCountChoices(17), [5, 10, 17]);
  assert.deepEqual(QuestionSelector.getCountChoices(20), [5, 10, 20]);
});

test('does not offer the complete pool above the safe item limit', function () {
  assert.equal(QuestionSelector.MAX_SELECTABLE_ITEMS, 20);
  assert.deepEqual(
    QuestionSelector.getCountChoices(21),
    [5, 10, 20]
  );
  assert.deepEqual(
    QuestionSelector.getCountChoices(5000),
    [5, 10, 20]
  );
});

test('limits automatic game selection and respects the item order setting', function () {
  const questions = Array.from({ length: 50 }, function (value, index) {
    return `Question ${index}`;
  });
  const normal = QuestionSelector.selectForGame(questions, 'normal');
  const random = QuestionSelector.selectForGame(
    questions,
    'random',
    createRandom([0.1, 0.9, 0.3, 0.7])
  );

  assert.deepEqual(normal.indices, Array.from({ length: 20 }, function (value, index) {
    return index;
  }));
  assert.equal(random.indices.length, 20);
  assert.equal(random.indices.some(function (index) {
    return index >= 20;
  }), true);
});

test('rejects invalid selection arguments', function () {
  assert.throws(function () {
    QuestionSelector.sampleIndices(-1, 1);
  }, RangeError);
  assert.throws(function () {
    QuestionSelector.sampleIndices(10, 0);
  }, RangeError);
  assert.throws(function () {
    QuestionSelector.selectSubset({}, 1);
  }, TypeError);
  assert.throws(function () {
    QuestionSelector.selectFirst([], 0);
  }, RangeError);
});

test('defines aligned author settings and translations for item selection', function () {
  const root = path.join(__dirname, '..');
  const semantics = JSON.parse(fs.readFileSync(
    path.join(root, 'semantics.json'),
    'utf8'
  ));
  const english = JSON.parse(fs.readFileSync(
    path.join(root, 'language', '.en.json'),
    'utf8'
  ));
  const behaviourIndex = semantics.findIndex(function (field) {
    return field.name === 'behaviour';
  });
  const itemChoice = semantics[behaviourIndex].fields.find(function (field) {
    return field.name === 'enableItemCountChoice';
  });

  assert.equal(itemChoice.default, false);
  assert.equal(semantics.some(function (field) {
    return field.name === 'numItemsQuestion';
  }), true);
  assert.equal(semantics.some(function (field) {
    return field.name === 'allItems';
  }), true);
  assert.equal(semantics.some(function (field) {
    return field.name === 'words';
  }), true);

  ['.en.json', 'fr.json', 'pt.json', 'pt-br.json', 'pt-pt.json']
    .forEach(function (file) {
      const translation = JSON.parse(fs.readFileSync(
        path.join(root, 'language', file),
        'utf8'
      ));
      assert.equal(translation.semantics.length, semantics.length, file);
      assert.equal(
        translation.semantics[behaviourIndex].fields.length,
        semantics[behaviourIndex].fields.length,
        file
      );
    });

  assert.equal(english.semantics.length, semantics.length);
});
