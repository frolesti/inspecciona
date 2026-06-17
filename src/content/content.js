(function () {
  /* ── Estils inline ─────────────────────────────────────────────────────────
     Cap fitxer CSS extern. Tots els estils estan aquí, agrupats per element.
     Modifica ÚNICAMENT aquest objecte per canviar l'aparença del panell.
  ─────────────────────────────────────────────────────────────────────────── */
  const ST = {
    button:
      "position:absolute;z-index:2147483600;display:none;border:none;border-radius:999px;" +
      "padding:6px 12px;background:linear-gradient(120deg,#173e2c,#2d7e59);color:#f4fff8;" +
      "font-size:12px;font-weight:600;cursor:pointer;" +
      "box-shadow:0 4px 12px rgba(0,0,0,.28);font-family:'Segoe UI',sans-serif;line-height:1.4",

    panel:
      "position:fixed;right:18px;top:18px;width:min(440px,calc(100vw - 36px));" +
      "max-height:calc(100vh - 36px);overflow:auto;z-index:2147483601;background:#f8f6ef;" +
      "color:#152019;border:1px solid #c7b988;border-radius:12px;" +
      "box-shadow:0 18px 45px rgba(10,20,13,.36);font-family:'Segoe UI',sans-serif;" +
      "font-size:14px;display:none",

    header:
      "display:flex;justify-content:space-between;align-items:center;" +
      "border-bottom:1px solid #dbcda2;padding:10px 12px;" +
      "background:linear-gradient(180deg,#efe8d5,#e2d7b3)",

    headerStrong: "font-weight:600;font-size:15px",

    closeBtn:
      "border:none;background:transparent;font-size:20px;cursor:pointer;line-height:1;padding:0",

    body: "padding:10px 12px",

    label: "display:block;margin-bottom:6px;font-size:12px",

    textarea:
      "width:100%;border:1px solid #b6ac8d;border-radius:8px;padding:8px;" +
      "background:#fffdf7;resize:vertical;color:#152019;box-sizing:border-box;" +
      "font-family:inherit;font-size:13px",

    actions: "margin-top:8px;display:flex;gap:8px",

    btn:
      "border:1px solid #355f46;border-radius:8px;padding:6px 10px;background:#e7f2ea;" +
      "color:#173e2c;cursor:pointer;font-size:13px",

    block: "margin-top:14px",

    h4: "margin:0 0 8px;font-size:14px;font-weight:600",

    status: "margin:0 0 8px;font-size:12px",

    inline: "margin-top:8px;display:flex;gap:8px;align-items:center",

    input:
      "flex:1;border:1px solid #b6ac8d;border-radius:8px;padding:6px 8px;" +
      "box-sizing:border-box;font-size:13px;font-family:inherit",

    ul: "margin:4px 0;padding-left:18px",

    li: "margin-bottom:8px",

    msg: "margin:0 0 4px;font-size:12px;line-height:1.45",

    ctx: "margin:0 0 4px;font-size:12px;line-height:1.45;color:#5d5a4c",

    repls: "display:flex;gap:6px;flex-wrap:wrap;margin-top:4px",

    token:
      "border:1px solid #a89d79;background:#fff;color:#3a3420;border-radius:999px;" +
      "padding:2px 8px;font-size:12px;cursor:pointer"
  };

  /* ── Estat ─────────────────────────────────────────────────────────────── */
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

  /* ── Inicialització ─────────────────────────────────────────────────────── */
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

  /* ── Construcció del UI ─────────────────────────────────────────────────── */
  function ensureUi() {
    if (state.root) return;

    const root = document.createElement("div");

    const button = document.createElement("button");
    button.style.cssText = ST.button;
    button.textContent = "Inspecciona";
    button.type = "button";
    button.addEventListener("click", openPanel);

    const panel = document.createElement("section");
    panel.style.cssText = ST.panel;
    panel.innerHTML = `
      <header style="${ST.header}">
        <strong style="${ST.headerStrong}">Inspecciona</strong>
        <button type="button" data-insp="close" style="${ST.closeBtn}" title="Tanca">×</button>
      </header>
      <div style="${ST.body}">
        <label style="${ST.label}">Text a revisar</label>
        <textarea data-insp="text" rows="6" style="${ST.textarea}" placeholder="Escriu o enganxa text en català..."></textarea>
        <div style="${ST.actions}">
          <button type="button" data-insp="check" style="${ST.btn}">Corregir</button>
          <button type="button" data-insp="apply" style="${ST.btn}">Enganxar al camp</button>
        </div>
        <div style="${ST.block}">
          <h4 style="${ST.h4}">Resultats de correcció</h4>
          <p data-insp="status" style="${ST.status}"></p>
          <ul data-insp="corrections" style="${ST.ul}"></ul>
        </div>
        <div style="${ST.block}">
          <h4 style="${ST.h4}">Sinònims</h4>
          <div style="${ST.inline}">
            <input data-insp="word" type="text" style="${ST.input}" placeholder="Paraula" />
            <button type="button" data-insp="synonyms" style="${ST.btn}">Cerca</button>
          </div>
          <div style="${ST.inline}">
            <input data-insp="prefix" type="text" style="${ST.input}" placeholder="Suggeriments ràpids" />
            <button type="button" data-insp="autocomplete" style="${ST.btn}">Suggerir</button>
          </div>
          <ul data-insp="autocomplete-list" style="${ST.ul}"></ul>
          <ul data-insp="synonyms-list" style="${ST.ul}"></ul>
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

  /* ── Panell ─────────────────────────────────────────────────────────────── */
  function openPanel() {
    if (!state.panel) return;
    state.textArea.value = state.target ? extractText(state.target) : "";
    state.status.textContent = "";
    state.corrections.innerHTML = "";
    state.synonyms.innerHTML = "";
    state.autocomplete.innerHTML = "";
    state.panel.style.display = "";
  }

  function closePanel() {
    state.panel.style.display = "none";
  }

  /* ── Corrector ──────────────────────────────────────────────────────────── */
  async function runCheck() {
    const text = state.textArea.value.trim();
    if (!text) { setStatus("No hi ha text per revisar."); return; }

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

  function renderCorrections(data, originalText) {
    const matches = data?.matches || [];
    if (!matches.length) { setStatus("No s'han detectat errors."); return; }

    setStatus(`${matches.length} incidència(es) detectada(es).`);
    for (const match of matches.slice(0, 40)) {
      const li = document.createElement("li");
      li.style.cssText = ST.li;

      const title = document.createElement("p");
      title.style.cssText = ST.msg;
      title.textContent = match.message || "Possibilitat de millora";

      const ctx = document.createElement("p");
      ctx.style.cssText = ST.ctx;
      ctx.textContent = match.context?.text || originalText.slice(match.offset, match.offset + match.length);

      li.appendChild(title);
      li.appendChild(ctx);

      const replacements = match.replacements || [];
      if (replacements.length > 0) {
        const wrap = document.createElement("div");
        wrap.style.cssText = ST.repls;
        for (const rep of replacements.slice(0, 5)) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.style.cssText = ST.token;
          btn.textContent = rep.value;
          btn.addEventListener("click", () => applySingleReplacement(match.offset, match.length, rep.value));
          wrap.appendChild(btn);
        }
        li.appendChild(wrap);
      }
      state.corrections.appendChild(li);
    }
  }

  /* ── Sinònims ───────────────────────────────────────────────────────────── */
  async function runSynonyms() {
    const wordEl = state.panel.querySelector('[data-insp="word"]');
    const word = wordEl.value.trim();
    if (!word) { state.synonyms.innerHTML = "<li>Introdueix una paraula.</li>"; return; }

    state.synonyms.innerHTML = "<li>Buscant...</li>";
    const response = await sendMessage({ type: "inspecciona:synonyms", word });

    if (!response.ok) {
      state.synonyms.innerHTML = `<li>${escapeHtml(response.error || "Error cercant sinònims")}</li>`;
      return;
    }
    renderSynonyms(response.data);
  }

  function renderSynonyms(data) {
    const entries = data?.results || [];
    if (!entries.length) { state.synonyms.innerHTML = "<li>No s'han trobat resultats.</li>"; return; }

    const words = [];
    for (const entry of entries) {
      for (const synEntry of entry.synonymEntries || []) {
        for (const w of synEntry.synonimWords || []) {
          if (w.wordString && !words.includes(w.wordString)) words.push(w.wordString);
        }
      }
    }

    if (!words.length) { state.synonyms.innerHTML = "<li>No s'han trobat sinònims.</li>"; return; }

    state.synonyms.innerHTML = words
      .slice(0, 60)
      .map((w) => `<li><button style="${ST.token}" type="button">${escapeHtml(w)}</button></li>`)
      .join("");

    state.synonyms.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => insertWord(b.textContent))
    );
  }

  /* ── Autocomplete ───────────────────────────────────────────────────────── */
  async function runAutocomplete() {
    const prefixEl = state.panel.querySelector('[data-insp="prefix"]');
    const prefix = prefixEl.value.trim();
    if (!prefix) { state.autocomplete.innerHTML = "<li>Introdueix un prefix.</li>"; return; }

    state.autocomplete.innerHTML = "<li>Buscant...</li>";
    const response = await sendMessage({ type: "inspecciona:autocomplete", prefix });

    if (!response.ok) {
      state.autocomplete.innerHTML = `<li>${escapeHtml(response.error || "Error en suggeriments")}</li>`;
      return;
    }

    const words = response.data?.words || [];
    if (!words.length) { state.autocomplete.innerHTML = "<li>Sense suggeriments.</li>"; return; }

    state.autocomplete.innerHTML = words
      .slice(0, 12)
      .map((w) => `<li><button style="${ST.token}" type="button">${escapeHtml(w)}</button></li>`)
      .join("");

    state.autocomplete.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        state.panel.querySelector('[data-insp="word"]').value = b.textContent;
      })
    );
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
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
    setText(state.target, state.textArea.value);
    setStatus("Text actualitzat al camp.");
  }

  function setStatus(message) { state.status.textContent = message; }

  function showButton() { state.button.style.display = ""; }

  function hideButton() { if (state.button) state.button.style.display = "none"; }

  function placeButton() {
    if (!state.target || !state.button || state.button.style.display === "none") return;
    const rect = state.target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { hideButton(); return; }
    state.button.style.top  = `${window.scrollY + rect.top + 6}px`;
    state.button.style.left = `${window.scrollX + rect.right - 106}px`;
  }

  function getEditableTarget(target) {
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
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value || "";
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
