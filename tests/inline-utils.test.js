const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMatchKind, getMarkerStyles } = require('../src/content/inline-utils.js');

test('classifyMatchKind marks misspellings as typo', () => {
  const result = classifyMatchKind({
    rule: { category: { id: 'TYPOS' }, issueType: 'misspelling', id: 'MORFOLOGIK' }
  });
  assert.equal(result, 'typo');
});

test('getMarkerStyles returns the expected color and label for grammar issues', () => {
  const styles = getMarkerStyles('grammar');
  assert.equal(styles.label, 'Gramàtica');
  assert.equal(styles.color, '#2c5d8a');
});
