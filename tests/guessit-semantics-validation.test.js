'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const semantics = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'semantics.json'),
  'utf8'
));

const getRegexpFields = function (
  fields,
  parentPath = '',
  results = []
) {
  fields.forEach(function (field) {
    const fieldPath = parentPath ?
      `${parentPath}.${field.name}` :
      field.name;

    if (field.regexp) {
      results.push({
        field,
        path: fieldPath
      });
    }

    if (field.type === 'list' && field.field) {
      const listPath = `${fieldPath}[]`;
      if (field.field.type === 'group') {
        getRegexpFields(field.field.fields, listPath, results);
      }
      else if (field.field.regexp) {
        results.push({
          field: field.field,
          path: listPath
        });
      }
    }
    else if (field.type === 'group' && field.fields) {
      getRegexpFields(field.fields, fieldPath, results);
    }
  });

  return results;
};

const validateRegexpValues = function (
  content,
  fields,
  parentPath = '',
  results = []
) {
  fields.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(content, field.name)) {
      return;
    }

    const value = content[field.name];
    const fieldPath = parentPath ?
      `${parentPath}.${field.name}` :
      field.name;

    if (field.regexp) {
      const optionalEmpty = value === '' && field.optional === true;
      const pattern = new RegExp(
        field.regexp.pattern,
        field.regexp.modifiers || ''
      );
      results.push({
        path: fieldPath,
        valid: optionalEmpty || (
          typeof value === 'string' && pattern.test(value)
        ),
        value
      });
    }

    if (field.type === 'list' && Array.isArray(value) && field.field) {
      value.forEach(function (item, index) {
        if (field.field.type === 'group' && item &&
          typeof item === 'object') {
          validateRegexpValues(
            item,
            field.field.fields,
            `${fieldPath}[${index}]`,
            results
          );
        }
      });
    }
    else if (field.type === 'group' && value &&
      typeof value === 'object') {
      validateRegexpValues(
        value,
        field.fields,
        fieldPath,
        results
      );
    }
  });

  return results;
};

test('the Wordle regexp has one exact semantic field path', function () {
  const regexpFields = getRegexpFields(semantics);

  assert.deepEqual(
    regexpFields.map(function (entry) {
      return entry.path;
    }),
    ['questionsW[].sentence']
  );
});

test('WordPress-compatible Wordle validation uses Unicode mode', function () {
  const regexpField = getRegexpFields(semantics)[0].field;
  const pattern = new RegExp(
    regexpField.regexp.pattern,
    regexpField.regexp.modifiers || ''
  );

  assert.equal(regexpField.regexp.modifiers, 'u');
  ['WORD', 'ELEPHANT', 'précéder', 'étage'].forEach(function (word) {
    assert.equal(pattern.test(word), true, word);
  });
});

test('Wordle semantics retain the existing invalid-word rules', function () {
  const regexpField = getRegexpFields(semantics)[0].field;
  const pattern = new RegExp(
    regexpField.regexp.pattern,
    regexpField.regexp.modifiers || ''
  );

  [
    'CAT',
    'ABCDEFGHI',
    'MOT-DEUX',
    'DEUX MOTS',
    'MOT2',
    "L'AMI",
    'MOT!'
  ].forEach(function (word) {
    assert.equal(pattern.test(word), false, word);
  });
});

test('the diagnostic reports the full path of each checked value', function () {
  const fixture = {
    playMode: 'userSentence',
    playModeW: 'availableSentences',
    questions: [{}],
    questionsW: [
      { sentence: 'précéder' },
      { sentence: '' }
    ],
    wordle: true
  };

  assert.deepEqual(validateRegexpValues(fixture, semantics), [
    {
      path: 'questionsW[0].sentence',
      valid: true,
      value: 'précéder'
    },
    {
      path: 'questionsW[1].sentence',
      valid: true,
      value: ''
    }
  ]);
});

test('empty inactive Wordle fields do not block semantic validation', function () {
  const inactiveFixture = {
    playMode: 'availableSentences',
    playModeW: 'userSentence',
    questions: [{ sentence: 'A usable sentence' }],
    questionsW: [{ sentence: '' }],
    wordle: false
  };

  assert.deepEqual(
    validateRegexpValues(inactiveFixture, semantics),
    [{
      path: 'questionsW[0].sentence',
      valid: true,
      value: ''
    }]
  );
});

test('NFD words are not claimed as valid in the authoring save path', function () {
  const regexpField = getRegexpFields(semantics)[0].field;
  const pattern = new RegExp(
    regexpField.regexp.pattern,
    regexpField.regexp.modifiers || ''
  );

  assert.equal(pattern.test('pre\u0301ce\u0301der'), false);
});
