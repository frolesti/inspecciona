(function () {
  function classifyMatchKind(match) {
    const catId = (match?.rule?.category?.id || '').toUpperCase();
    const issue = (match?.rule?.issueType || '').toLowerCase();
    const ruleId = (match?.rule?.id || '').toUpperCase();

    if (catId === 'TYPOS' || ruleId.startsWith('MORFOLOGIK') || issue === 'misspelling') {
      return 'typo';
    }
    if (catId === 'STYLE' || catId === 'REDUNDANCY' || catId === 'COLLOCATIONS' || issue === 'style') {
      return 'style';
    }
    return 'grammar';
  }

  function getMarkerStyles(kind) {
    const styles = {
      typo: { color: '#c0392b', label: 'Ortografia' },
      grammar: { color: '#2c5d8a', label: 'Gramàtica' },
      style: { color: '#1f5f3e', label: 'Estil' }
    };
    return styles[kind] || styles.grammar;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { classifyMatchKind, getMarkerStyles };
  }

  if (typeof window !== 'undefined') {
    window.InspeccionaInlineUtils = { classifyMatchKind, getMarkerStyles };
  }
})();
