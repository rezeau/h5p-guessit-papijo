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


const englishLocalisation = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'language', '.en.json'),
  'utf8'
));

const portugueseLocalisations = [
  {
    code: 'pt',
    caseSensitiveLabel: 'Distinguir maiúsculas de minúsculas'
  },
  {
    code: 'pt-br',
    caseSensitiveLabel: 'Diferenciar maiúsculas de minúsculas'
  },
  {
    code: 'pt-pt',
    caseSensitiveLabel: 'Distinguir maiúsculas de minúsculas'
  }
].map(function (locale) {
  return {
    ...locale,
    data: JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'language', locale.code + '.json'),
      'utf8'
    ))
  };
});

const getTranslationShape = function (value) {
  if (Array.isArray(value)) {
    return value.map(getTranslationShape);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(function (entry) {
      return [entry[0], getTranslationShape(entry[1])];
    }));
  }

  return typeof value;
};

const getValueAtPath = function (value, valuePath) {
  return valuePath.reduce(function (current, segment) {
    return current[segment];
  }, value);
};

const getPlaceholderMap = function (
  value,
  valuePath = '$',
  placeholders = {}
) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      getPlaceholderMap(
        item,
        valuePath + '[' + index + ']',
        placeholders
      );
    });
  }
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(function (entry) {
      getPlaceholderMap(
        entry[1],
        valuePath + '.' + entry[0],
        placeholders
      );
    });
  }
  else if (typeof value === 'string') {
    placeholders[valuePath] = (
      value.match(/@[A-Za-z][A-Za-z0-9_]*|:ans/g) || []
    ).sort();
  }

  return placeholders;
};

test('Portuguese localisations retain semantic alignment', function () {
  assert.equal(
    englishLocalisation.semantics.length,
    semantics.length
  );
  assert.equal(semantics[8].fields[0].name, 'caseSensitive');

  const englishShape = getTranslationShape(englishLocalisation);
  portugueseLocalisations.forEach(function (locale) {
    assert.deepEqual(
      getTranslationShape(locale.data),
      englishShape,
      locale.code
    );
    assert.equal(
      locale.data.semantics.length,
      semantics.length,
      locale.code
    );
    assert.equal(
      locale.data.semantics[8].fields[0].label,
      locale.caseSensitiveLabel,
      locale.code
    );
  });
});

test('required Portuguese Wordle strings are translated', function () {
  const requiredPaths = [
    ['semantics', 2, 'label'],
    ['semantics', 2, 'description'],
    ['semantics', 4, 'label'],
    ['semantics', 4, 'description'],
    ['semantics', 4, 'options', 0, 'label'],
    ['semantics', 4, 'options', 1, 'label'],
    ['semantics', 7, 'label'],
    ['semantics', 7, 'description'],
    ['semantics', 7, 'widgets', 0, 'label'],
    ['semantics', 7, 'field', 'label'],
    ['semantics', 7, 'field', 'fields', 0, 'label'],
    ['semantics', 7, 'field', 'fields', 0, 'description'],
    ['semantics', 7, 'field', 'fields', 1, 'label'],
    ['semantics', 7, 'field', 'fields', 1, 'description'],
    ['semantics', 8, 'fields', 8, 'label'],
    ['semantics', 8, 'fields', 8, 'description'],
    ['semantics', 11, 'label'],
    ['semantics', 11, 'default'],
    ['semantics', 17, 'label'],
    ['semantics', 17, 'default'],
    ['semantics', 29, 'label'],
    ['semantics', 29, 'default'],
    ['semantics', 29, 'description'],
    ['semantics', 32, 'label'],
    ['semantics', 32, 'default'],
    ['semantics', 32, 'description'],
    ['semantics', 34, 'label'],
    ['semantics', 34, 'default'],
    ['semantics', 34, 'description'],
    ['semantics', 44, 'label'],
    ['semantics', 44, 'default'],
    ['semantics', 45, 'description'],
    ['semantics', 48, 'label'],
    ['semantics', 48, 'default'],
    ['semantics', 49, 'label'],
    ['semantics', 49, 'default'],
    ['semantics', 50, 'label'],
    ['semantics', 50, 'default']
  ];

  portugueseLocalisations.forEach(function (locale) {
    requiredPaths.forEach(function (valuePath) {
      assert.notEqual(
        getValueAtPath(locale.data, valuePath),
        getValueAtPath(englishLocalisation, valuePath),
        locale.code + ': ' + valuePath.join('.')
      );
    });
  });
});

test('Portuguese localisation placeholders match English', function () {
  const englishPlaceholders = getPlaceholderMap(englishLocalisation);

  portugueseLocalisations.forEach(function (locale) {
    assert.deepEqual(
      getPlaceholderMap(locale.data),
      englishPlaceholders,
      locale.code
    );
  });
});
