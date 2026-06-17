(function () {
  function isEditableTarget(target) {
    if (!target) return null;

    if (target instanceof HTMLTextAreaElement) return target;

    if (target instanceof HTMLInputElement) {
      const type = (target.type || "text").toLowerCase();
      return ["text", "search", "email", "url"].includes(type) ? target : null;
    }

    if (target.isContentEditable) return target;

    return target.closest?.("[contenteditable='true']") || null;
  }

  function extractText(target) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value || "";
    }
    return target.innerText || target.textContent || "";
  }

  function setText(target, text) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.value = text;
    } else {
      target.innerText = text;
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function sendMessage(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "Sense resposta del servei." });
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  window.InspeccionaHelpers = {
    isEditableTarget,
    extractText,
    setText,
    sendMessage,
    escapeHtml,
    uniqueSynonymWords
  };
})();
