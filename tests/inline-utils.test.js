const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyMatchKind, getMarkerStyles } = require('../src/content/inline-utils.js');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

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

test('dictionary resolves validated plural lemmas without using related expressions', async () => {
  const source = readFileSync(join(__dirname, '../src/background.js'), 'utf8');
  const start = source.indexOf('async function handleDictionaryMessage(');
  const end = source.indexOf('\nfunction extractCatalanDefinitions', start);
  assert.ok(start >= 0 && end > start);
  const requests = [];
  const context = vm.createContext({
    normalizeWord: (word) => String(word).trim(),
    resolveBackendEndpoints: async () => ({ dictionary: '/dictionary/', mode: 'test' }),
    assertHostPermission: async () => {},
    recordBackendUsage: () => {},
    fetchWithTimeout: async (url) => {
      const word = decodeURIComponent(url.split('/').pop().split('?')[0]);
      requests.push(word);
      return { ok: true, json: async () => ['amic', 'amiga', 'gos'].includes(word)
        ? [{ word_ca: word, definition_ca: 'Definition' }] : [] };
    },
    handleSynonymsMessage: async () => ({
      canonicalLemma: 'fer cara de pocs amics',
      results: [{ lemma: 'fer cara de pocs amics' }, { lemma: 'amic', feminineLemma: 'amiga' }, { lemma: 'gos' }]
    })
  });
  vm.runInContext(source.slice(start, end), context);
  for (const [word, expected] of [['amics', 'amic'], ['Amics', 'amic'], ['amigues', 'amiga'], ['gossos', 'gos']]) {
    requests.length = 0;
    const result = await context.handleDictionaryMessage({ word });
    assert.equal(result.word, expected);
    assert.equal(result.wordFound, true);
    assert.deepEqual(requests, [word, expected]);
  }
  requests.length = 0;
  assert.equal((await context.handleDictionaryMessage({ word: 'amic' })).wordFound, true);
  assert.deepEqual(requests, ['amic']);
  requests.length = 0;
  assert.equal((await context.handleDictionaryMessage({ word: 'inventats' })).wordFound, false);
  assert.deepEqual(requests, ['inventats']);
  context.handleSynonymsMessage = async () => ({ results: [
    { lemma: 'subtitular', grammarCategory: 'v' },
    { lemma: 'corrector', feminineLemma: 'correctora', grammarCategory: 'n' }
  ] });
  context.fetchWithTimeout = async (url) => {
    const word = decodeURIComponent(url.split('/').pop().split('?')[0]);
    requests.push(word);
    return { ok: true, json: async () => ['subtitular', 'corrector'].includes(word)
      ? [{ word_ca: word, definition_ca: 'Definition' }] : [] };
  };
  for (const [word, expected] of [['subtitulada', 'subtitular'], ['Subtitulades', 'subtitular'],
    ['subtitulat', 'subtitular'], ['correctora', 'corrector'], ['correctores', 'corrector']]) {
    requests.length = 0;
    const result = await context.handleDictionaryMessage({ word });
    assert.equal(result.word, expected);
    assert.equal(result.wordFound, true);
    assert.equal(requests[0], word);
    assert.equal(requests.at(-1), expected);
  }
  assert.equal((await context.handleDictionaryMessage({ word: 'inventada' })).wordFound, false);
  context.handleSynonymsMessage = async () => { throw new Error('Unavailable'); };
  assert.equal((await context.handleDictionaryMessage({ word: 'inventats' })).wordFound, false);
});
