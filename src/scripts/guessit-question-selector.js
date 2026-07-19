'use strict';

const COUNT_CHOICES = [5, 10, 20, 50, 100];

const normalizeCount = function (total, requested) {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError('The total number of questions must be a non-negative integer.');
  }
  if (!Number.isInteger(requested) || requested < 1) {
    throw new RangeError('The requested number of questions must be a positive integer.');
  }

  return Math.min(total, requested);
};

/**
 * Select unique random indices without copying or shuffling the complete pool.
 * Uses Floyd's sampling algorithm and returns indices in source order.
 *
 * @param {number} total Number of items in the source pool.
 * @param {number} requested Number of items to select.
 * @param {function} [random] Random number generator returning a value in [0, 1).
 * @returns {number[]} Selected source indices.
 */
const sampleIndices = function (total, requested, random = Math.random) {
  const count = normalizeCount(total, requested);
  const selected = Object.create(null);
  const selectedIndices = [];

  for (let index = total - count; index < total; index++) {
    const candidate = Math.floor(random() * (index + 1));
    const selectedIndex = selected[candidate] ? index : candidate;
    selected[selectedIndex] = true;
    selectedIndices.push(selectedIndex);
  }

  return selectedIndices.sort(function (a, b) {
    return a - b;
  });
};

const selectByIndices = function (items, indices) {
  if (!Array.isArray(items) || !Array.isArray(indices)) {
    throw new TypeError('The question pool and selected indices must be arrays.');
  }

  const validIndices = indices.filter(function (index) {
    return Number.isInteger(index) && index >= 0 && index < items.length;
  });

  return {
    indices: validIndices,
    items: validIndices.map(function (index) {
      return items[index];
    })
  };
};

/**
 * Select a small subset while accessing only the selected source items.
 *
 * @param {Array} items Source item pool.
 * @param {number} requested Number of items to select.
 * @param {function} [random] Random number generator.
 * @returns {{indices: number[], items: Array}} Selected indices and items.
 */
const selectSubset = function (items, requested, random = Math.random) {
  if (!Array.isArray(items)) {
    throw new TypeError('The question pool must be an array.');
  }

  const indices = sampleIndices(items.length, requested, random);
  return selectByIndices(items, indices);
};

/**
 * Select the first items from a pool while preserving author order.
 *
 * @param {Array} items Source item pool.
 * @param {number} requested Number of items to select.
 * @returns {{indices: number[], items: Array}} Selected indices and items.
 */
const selectFirst = function (items, requested) {
  if (!Array.isArray(items)) {
    throw new TypeError('The question pool must be an array.');
  }

  const count = normalizeCount(items.length, requested);
  const indices = Array.from({ length: count }, function (value, index) {
    return index;
  });
  return selectByIndices(items, indices);
};

/**
 * Return scalable quantity choices with the complete pool as the final choice.
 *
 * @param {number} total Number of available items.
 * @returns {number[]} Quantity choices.
 */
const getCountChoices = function (total) {
  if (!Number.isInteger(total) || total < 1) {
    return [];
  }

  if (total <= COUNT_CHOICES[0]) {
    return Array.from({ length: total }, function (value, index) {
      return index + 1;
    });
  }

  return COUNT_CHOICES.filter(function (count) {
    return count < total;
  }).concat(total);
};

module.exports = {
  getCountChoices,
  sampleIndices,
  selectByIndices,
  selectFirst,
  selectSubset
};
