(function () {
  function isEditableTarget(target) {
    if (!target) return null;

    if (target instanceof HTMLTextAreaElement) return target;

    if (target instanceof HTMLInputElement) {
      const type = (target.type || "text").toLowerCase();
      return ["text", "search", "email", "url"].includes(type) ? target : null;
    }

    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!element || !element.closest) return null;

    return element.closest("[contenteditable='true'], [contenteditable='plaintext-only']") || null;
  }

  function extractText(target) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value || "";
    }
    return target.innerText || target.textContent || "";
  }

  function setText(target, text) {
    try {
      target.focus();

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.value = text;
      } else {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("insertText", false, text);
      }

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      // L'editor pot rebutjar la inserció (alguns editors rics interfereixen).
      // Fallem silenciosament per no trencar la pàgina.
      console.warn("[Inspecciona] No s'ha pogut escriure al camp:", error?.message || error);
    }
  }

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
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: "Sense resposta del servei." });
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

  function isSingleWord(text) {
    return /^\p{L}[\p{L}'’\-]*$/u.test(String(text || "").trim());
  }

  function replaceTextSlice(text, offset, length, replacement) {
    return text.slice(0, offset) + replacement + text.slice(offset + length);
  }

  window.InspeccionaHelpers = {
    isEditableTarget,
    extractText,
    setText,
    sendMessage,
    isExtensionAlive,
    uniqueSynonymWords,
    isSingleWord,
    replaceTextSlice
  };
})();
