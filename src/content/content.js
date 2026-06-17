(function () {
  const state = {
    target: null,
    root: null,
    button: null,
    panel: null,
    textArea: null,
    status: null,
    corrections: null,
    synonyms: null,
    autocomplete: null,
    variant: "general"
  };

  init();

  function init() {
    chrome.storage.sync.get({ variant: "general", autoOpenHelper: true }, (cfg) => {
      state.variant = cfg.variant || "general";
      if (cfg.autoOpenHelper) {
        attachEvents();
        ensureUi();
      }
    });
  }

  function attachEvents() {
    document.addEventListener("focusin", onFocusIn, true);
    window.addEventListener("scroll", placeButton, true);
    window.addEventListener("resize", placeButton);
  }

  function onFocusIn(event) {
    const editable = getEditableTarget(event.target);
    if (!editable) {
      hideButton();
      return;
    }

    state.target = editable;
    showButton();
    placeButton();
  }

  function ensureUi() {
    if (state.root) {
      return;
    }

    const root = document.createElement("div");
    root.className = "insp-root";

    const button = document.createElement("button");
    button.className = "insp-open-btn";
    button.textContent = "Inspecciona";
    button.type = "button";
    button.addEventListener("click", openPanel);

    const panel = document.createElement("section");
    panel.className = "insp-panel insp-hidden";
    panel.innerHTML = `
      <header class="insp-header">
        <strong>Inspecciona</strong>
        <button type="button" class="insp-close" title="Tanca">×</button>
      </header>
      <div class="insp-body">
        <label class="insp-label">Text a revisar</label>
        <textarea class="insp-text" rows="6" placeholder="Escriu o enganxa text en català..."></textarea>
        <div class="insp-actions">
          <button type="button" data-action="check">Corregir</button>
          <button type="button" data-action="apply">Enganxar al camp</button>
        </div>
        <div class="insp-block">
          <h4>Resultats de correcció</h4>
          <p class="insp-status"></p>
          <ul class="insp-corrections"></ul>
        </div>
        <div class="insp-block">
          <h4>Sinònims</h4>
          <div class="insp-inline">
            <input class="insp-word" type="text" placeholder="Paraula" />
            <button type="button" data-action="synonyms">Cerca</button>
          </div>
          <div class="insp-inline">
            <input class="insp-prefix" type="text" placeholder="Suggeriments ràpids" />
            <button type="button" data-action="autocomplete">Suggerir</button>
          </div>
          <ul class="insp-autocomplete"></ul>
          <ul class="insp-synonyms"></ul>
        </div>
      </div>
    `;

    root.appendChild(button);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    state.root = root;
    state.button = button;
    state.panel = panel;
    state.textArea = panel.querySelector(".insp-text");
    state.status = panel.querySelector(".insp-status");
    state.corrections = panel.querySelector(".insp-corrections");
    state.synonyms = panel.querySelector(".insp-synonyms");
    state.autocomplete = panel.querySelector(".insp-autocomplete");

    panel.querySelector(".insp-close").addEventListener("click", closePanel);
    panel.querySelector('[data-action="check"]').addEventListener("click", runCheck);
    panel.querySelector('[data-action="apply"]').addEventListener("click", applyToField);
    panel.querySelector('[data-action="synonyms"]').addEventListener("click", runSynonyms);
    panel.querySelector('[data-action="autocomplete"]').addEventListener("click", runAutocomplete);
  }

  function openPanel() {
    if (!state.panel) {
      return;
    }
    const text = state.target ? extractText(state.target) : "";
    state.textArea.value = text;
    state.status.textContent = "";
    state.corrections.innerHTML = "";
    state.synonyms.innerHTML = "";
    state.autocomplete.innerHTML = "";
    state.panel.classList.remove("insp-hidden");
  }

  function closePanel() {
    state.panel.classList.add("insp-hidden");
  }

  async function runCheck() {
    const text = state.textArea.value.trim();
    if (!text) {
      setStatus("No hi ha text per revisar.");
      return;
    }

    setStatus("Revisant...");
    state.corrections.innerHTML = "";

    const response = await sendMessage({
      type: "inspecciona:check",
      text,
      variant: state.variant
    });

    if (!response.ok) {
      setStatus(response.error || "No s'ha pogut completar la correcció.");
      return;
    }

    renderCorrections(response.data, text);
  }

  async function runSynonyms() {
    const wordEl = state.panel.querySelector(".insp-word");
    const word = wordEl.value.trim();
    if (!word) {
      state.synonyms.innerHTML = "<li>Introdueix una paraula.</li>";
      return;
    }

    state.synonyms.innerHTML = "<li>Buscant...</li>";
    const response = await sendMessage({ type: "inspecciona:synonyms", word });

    if (!response.ok) {
      state.synonyms.innerHTML = `<li>${escapeHtml(response.error || "Error cercant sinònims")}</li>`;
      return;
    }

    renderSynonyms(response.data);
  }

  async function runAutocomplete() {
    const prefixEl = state.panel.querySelector(".insp-prefix");
    const prefix = prefixEl.value.trim();
    if (!prefix) {
      state.autocomplete.innerHTML = "<li>Introdueix un prefix.</li>";
      return;
    }

    state.autocomplete.innerHTML = "<li>Buscant...</li>";
    const response = await sendMessage({ type: "inspecciona:autocomplete", prefix });

    if (!response.ok) {
      state.autocomplete.innerHTML = `<li>${escapeHtml(response.error || "Error en suggeriments")}</li>`;
      return;
    }

    const words = response.data?.words || [];
    if (!words.length) {
      state.autocomplete.innerHTML = "<li>Sense suggeriments.</li>";
      return;
    }

    state.autocomplete.innerHTML = words
      .slice(0, 12)
      .map((word) => `<li><button class="insp-token" type="button">${escapeHtml(word)}</button></li>`)
      .join("");

    state.autocomplete.querySelectorAll(".insp-token").forEach((button) => {
      button.addEventListener("click", () => {
        const wordInput = state.panel.querySelector(".insp-word");
        wordInput.value = button.textContent;
      });
    });
  }

  function renderCorrections(data, originalText) {
    const matches = data?.matches || [];
    if (!matches.length) {
      setStatus("No s'han detectat errors.");
      return;
    }

    setStatus(`${matches.length} incidència(es) detectada(es).`);
    for (const match of matches.slice(0, 40)) {
      const li = document.createElement("li");
      li.className = "insp-item";

      const title = document.createElement("p");
      title.className = "insp-msg";
      title.textContent = match.message || "Possibilitat de millora";

      const ctx = document.createElement("p");
      ctx.className = "insp-ctx";
      ctx.textContent = match.context?.text || originalText.slice(match.offset, match.offset + match.length);

      li.appendChild(title);
      li.appendChild(ctx);

      const replacements = match.replacements || [];
      if (replacements.length > 0) {
        const wrap = document.createElement("div");
        wrap.className = "insp-repls";
        for (const replacement of replacements.slice(0, 5)) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "insp-token";
          btn.textContent = replacement.value;
          btn.addEventListener("click", () => {
            applySingleReplacement(match.offset, match.length, replacement.value);
          });
          wrap.appendChild(btn);
        }
        li.appendChild(wrap);
      }

      state.corrections.appendChild(li);
    }
  }

  function renderSynonyms(data) {
    const entries = data?.results || [];
    if (!entries.length) {
      state.synonyms.innerHTML = "<li>No s'han trobat resultats.</li>";
      return;
    }

    const words = [];
    for (const entry of entries) {
      for (const synEntry of entry.synonymEntries || []) {
        for (const word of synEntry.synonimWords || []) {
          if (word.wordString && !words.includes(word.wordString)) {
            words.push(word.wordString);
          }
        }
      }
    }

    if (!words.length) {
      state.synonyms.innerHTML = "<li>No s'han trobat sinònims.</li>";
      return;
    }

    state.synonyms.innerHTML = words
      .slice(0, 60)
      .map((word) => `<li><button class="insp-token" type="button">${escapeHtml(word)}</button></li>`)
      .join("");

    state.synonyms.querySelectorAll(".insp-token").forEach((button) => {
      button.addEventListener("click", () => insertWord(button.textContent));
    });
  }

  function insertWord(word) {
    const value = state.textArea.value;
    state.textArea.value = value ? `${value} ${word}` : word;
  }

  function applySingleReplacement(offset, length, replacement) {
    const text = state.textArea.value;
    const before = text.slice(0, offset);
    const after = text.slice(offset + length);
    state.textArea.value = `${before}${replacement}${after}`;
  }

  function applyToField() {
    if (!state.target) {
      setStatus("No hi ha cap camp de text actiu.");
      return;
    }
    setText(state.target, state.textArea.value);
    setStatus("Text actualitzat al camp.");
  }

  function setStatus(message) {
    state.status.textContent = message;
  }

  function showButton() {
    state.button.classList.remove("insp-hidden");
  }

  function hideButton() {
    if (state.button) {
      state.button.classList.add("insp-hidden");
    }
  }

  function placeButton() {
    if (!state.target || !state.button || state.button.classList.contains("insp-hidden")) {
      return;
    }

    const rect = state.target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      hideButton();
      return;
    }

    state.button.style.top = `${window.scrollY + rect.top + 6}px`;
    state.button.style.left = `${window.scrollX + rect.right - 106}px`;
  }

  function getEditableTarget(target) {
    if (!target) {
      return null;
    }
    if (target instanceof HTMLTextAreaElement) {
      return target;
    }
    if (target instanceof HTMLInputElement) {
      const type = (target.type || "text").toLowerCase();
      if (["text", "search", "email", "url"].includes(type)) {
        return target;
      }
      return null;
    }
    if (target.isContentEditable) {
      return target;
    }
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
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    target.innerText = text;
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
})();