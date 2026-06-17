(function () {
  const H = window.InspeccionaHelpers;
  if (!H) return;

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
    const editable = H.isEditableTarget(event.target);
    if (!editable) {
      hideButton();
      return;
    }
    state.target = editable;
    showButton();
    placeButton();
  }

  function ensureUi() {
    if (state.root) return;

    const root = document.createElement("div");
    root.className = "insp-root";

    const button = document.createElement("button");
    button.className = "insp-open-btn";
    button.textContent = "Inspecciona";
    button.type = "button";
    button.addEventListener("click", openPanel);

    const panel = document.createElement("section");
    panel.className = "insp-panel";
    panel.innerHTML = `
      <header class="insp-header">
        <strong>Inspecciona</strong>
        <button type="button" class="insp-close" data-insp="close" title="Tanca">×</button>
      </header>
      <div class="insp-body">
        <label class="insp-label">Text a revisar</label>
        <textarea data-insp="text" class="insp-text" rows="6" placeholder="Escriu o enganxa text en català..."></textarea>
        <div class="insp-actions">
          <button type="button" data-insp="check">Corregir</button>
          <button type="button" data-insp="apply">Enganxar al camp</button>
        </div>
        <div class="insp-block">
          <h4>Resultats de correcció</h4>
          <p data-insp="status" class="insp-status"></p>
          <ul data-insp="corrections" class="insp-corrections"></ul>
        </div>
        <div class="insp-block">
          <h4>Sinònims</h4>
          <div class="insp-inline">
            <input data-insp="word" type="text" placeholder="Paraula" />
            <button type="button" data-insp="synonyms">Cerca</button>
          </div>
          <div class="insp-inline">
            <input data-insp="prefix" type="text" placeholder="Suggeriments ràpids" />
            <button type="button" data-insp="autocomplete">Suggerir</button>
          </div>
          <ul data-insp="autocomplete-list" class="insp-autocomplete"></ul>
          <ul data-insp="synonyms-list" class="insp-synonyms"></ul>
        </div>
      </div>
    `;

    root.appendChild(button);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    state.root        = root;
    state.button      = button;
    state.panel       = panel;
    state.textArea    = panel.querySelector('[data-insp="text"]');
    state.status      = panel.querySelector('[data-insp="status"]');
    state.corrections = panel.querySelector('[data-insp="corrections"]');
    state.synonyms    = panel.querySelector('[data-insp="synonyms-list"]');
    state.autocomplete = panel.querySelector('[data-insp="autocomplete-list"]');

    panel.querySelector('[data-insp="close"]').addEventListener("click", closePanel);
    panel.querySelector('[data-insp="check"]').addEventListener("click", runCheck);
    panel.querySelector('[data-insp="apply"]').addEventListener("click", applyToField);
    panel.querySelector('[data-insp="synonyms"]').addEventListener("click", runSynonyms);
    panel.querySelector('[data-insp="autocomplete"]').addEventListener("click", runAutocomplete);
  }

  function openPanel() {
    if (!state.panel) return;
    state.textArea.value = state.target ? H.extractText(state.target) : "";
    state.status.textContent = "";
    state.corrections.innerHTML = "";
    state.synonyms.innerHTML = "";
    state.autocomplete.innerHTML = "";
    state.panel.classList.add("is-open");
  }

  function closePanel() {
    state.panel.classList.remove("is-open");
  }

  async function runCheck() {
    const text = state.textArea.value.trim();
    if (!text) { setStatus("No hi ha text per revisar."); return; }

    setStatus("Revisant...");
    state.corrections.innerHTML = "";

    const response = await H.sendMessage({
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

  function renderCorrections(data, originalText) {
    const matches = data?.matches || [];
    if (!matches.length) { setStatus("No s'han detectat errors."); return; }

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
        for (const rep of replacements.slice(0, 5)) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "insp-token";
          btn.textContent = rep.value;
          btn.addEventListener("click", () => applySingleReplacement(match.offset, match.length, rep.value));
          wrap.appendChild(btn);
        }
        li.appendChild(wrap);
      }
      state.corrections.appendChild(li);
    }
  }

  async function runSynonyms() {
    const wordEl = state.panel.querySelector('[data-insp="word"]');
    const word = wordEl.value.trim();
    if (!word) { state.synonyms.innerHTML = "<li>Introdueix una paraula.</li>"; return; }

    state.synonyms.innerHTML = "<li>Buscant...</li>";
    const response = await H.sendMessage({ type: "inspecciona:synonyms", word });

    if (!response.ok) {
      state.synonyms.innerHTML = `<li>${H.escapeHtml(response.error || "Error cercant sinònims")}</li>`;
      return;
    }
    renderSynonyms(response.data);
  }

  function renderSynonyms(data) {
    const entries = data?.results || [];
    if (!entries.length) { state.synonyms.innerHTML = "<li>No s'han trobat resultats.</li>"; return; }

    const words = H.uniqueSynonymWords(entries);

    if (!words.length) { state.synonyms.innerHTML = "<li>No s'han trobat sinònims.</li>"; return; }

    state.synonyms.innerHTML = words
      .slice(0, 60)
      .map((w) => `<li><button class="insp-token" type="button">${H.escapeHtml(w)}</button></li>`)
      .join("");

    state.synonyms.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => insertWord(b.textContent))
    );
  }

  async function runAutocomplete() {
    const prefixEl = state.panel.querySelector('[data-insp="prefix"]');
    const prefix = prefixEl.value.trim();
    if (!prefix) { state.autocomplete.innerHTML = "<li>Introdueix un prefix.</li>"; return; }

    state.autocomplete.innerHTML = "<li>Buscant...</li>";
    const response = await H.sendMessage({ type: "inspecciona:autocomplete", prefix });

    if (!response.ok) {
      state.autocomplete.innerHTML = `<li>${H.escapeHtml(response.error || "Error en suggeriments")}</li>`;
      return;
    }

    const words = response.data?.words || [];
    if (!words.length) { state.autocomplete.innerHTML = "<li>Sense suggeriments.</li>"; return; }

    state.autocomplete.innerHTML = words
      .slice(0, 12)
      .map((w) => `<li><button class="insp-token" type="button">${H.escapeHtml(w)}</button></li>`)
      .join("");

    state.autocomplete.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        state.panel.querySelector('[data-insp="word"]').value = b.textContent;
      })
    );
  }

  function insertWord(word) {
    const v = state.textArea.value;
    state.textArea.value = v ? `${v} ${word}` : word;
  }

  function applySingleReplacement(offset, length, replacement) {
    const t = state.textArea.value;
    state.textArea.value = t.slice(0, offset) + replacement + t.slice(offset + length);
  }

  function applyToField() {
    if (!state.target) { setStatus("No hi ha cap camp de text actiu."); return; }
    H.setText(state.target, state.textArea.value);
    setStatus("Text actualitzat al camp.");
  }

  function setStatus(message) { state.status.textContent = message; }

  function showButton() { state.button.style.display = "block"; }

  function hideButton() { if (state.button) state.button.style.display = "none"; }

  function placeButton() {
    if (!state.target || !state.button || state.button.style.display === "none") return;
    const rect = state.target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { hideButton(); return; }
    state.button.style.top  = `${window.scrollY + rect.top + 6}px`;
    state.button.style.left = `${window.scrollX + rect.right - 106}px`;
  }
})();
