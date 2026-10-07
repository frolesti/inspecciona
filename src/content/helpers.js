(function () {
  function isExtensionAlive() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function sendMessage(payload) {
    return new Promise((resolve) => {
      if (!isExtensionAlive()) {
        resolve({ ok: false, error: "L'extensió s'ha actualitzat. Refresca la pàgina per continuar." });
        return;
      }
      try {
        chrome.runtime.sendMessage(payload, (response) => {
          try {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response || { ok: false, error: "Sense resposta del servei." });
          } catch (error) {
            resolve({ ok: false, error: error?.message || "L'extensió s'ha actualitzat. Refresca la pàgina per continuar." });
          }
        });
      } catch (error) {
        resolve({ ok: false, error: error?.message || "Error de comunicació." });
      }
    });
  }

  function uniqueSynonymWords(results) {
    const words = [];
    for (const entry of results || []) {
      for (const synonymEntry of entry.synonymEntries || []) {
        for (const word of synonymEntry.synonimWords || []) {
          if (word.wordString && !words.includes(word.wordString)) {
            words.push(word.wordString);
          }
        }
      }
    }
    return words;
  }

  function replaceTextSlice(text, offset, length, replacement) {
    return text.slice(0, offset) + replacement + text.slice(offset + length);
  }

  window.InspeccionaHelpers = {
    sendMessage,
    isExtensionAlive,
    uniqueSynonymWords,
    replaceTextSlice
  };
})();
