(function () {
  const H = window.InspeccionaHelpers;
  if (!H) return;

  /* ── Icones SVG (inline, una sola línia per facilitat de manteniment) ── */
  const ICONS = {
    correct: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    synonyms: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>',
    variant: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };

  /* ── Estat ─────────────────────────────────────────────────────────── */
  const PREF_DEFAULTS = {
    variant: "general",
    autoOpenHelper: true,
    diacritics: "iec",
    pronomSe: "simple",
    cometesTypo: false,
    puntsSuspe: false,
    apostrof: "",
    guio: "",
    guioPer: "",
    interrogant: "",
    exclamacio: "mai",
    percent: "sense",
    hora: ""
  };

  const state = {
    selection: null,
    workingText: "",
    matchFilter: "all",
    lastMatches: [],
    dismissed: new Set(),
    prefs: { ...PREF_DEFAULTS },
    enabled: true,
    root: null,
    toolbar: null,
    toolbarButtons: {},
    panel: null,
    panelTitle: null,
    panelPreview: null,
    panelStatus: null,
    panelActions: null,
    panelResults: null,
    panelDragged: false,
    drag: null
  };

  init();

  function init() {
    if (!H.isExtensionAlive()) return;

    chrome.storage.sync.get(PREF_DEFAULTS, (cfg) => {
      if (chrome.runtime.lastError) return;
      state.prefs = { ...PREF_DEFAULTS, ...cfg };
      state.enabled = state.prefs.autoOpenHelper !== false;
      attachEvents();
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!H.isExtensionAlive()) return;
        if (area !== "sync") return;
        for (const [key, change] of Object.entries(changes)) {
          if (key in PREF_DEFAULTS) state.prefs[key] = change.newValue;
        }
        if ("autoOpenHelper" in changes) {
          state.enabled = state.prefs.autoOpenHelper !== false;
          if (!state.enabled) {
            hideToolbar();
            closePanel();
          }
        }
      });
    } catch {
      // Si el context està invalidat ignorem; refrescar la pestanya el restablirà.
    }
  }

  function attachEvents() {
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
  }

  function onMouseUp(event) {
    if (!state.enabled) return;
    if (isInsideUi(event.target)) return;

    window.setTimeout(() => {
      const next = readEditableSelection(event.target);
      if (!next) {
        if (!isPanelOpen()) hideToolbar();
        return;
      }
      state.selection = next;
      if (!isPanelOpen()) {
        showToolbar(next.rect, H.isSingleWord(next.text));
      }
    }, 0);
  }

  function onPointerDown(event) {
    if (!state.enabled) return;
    if (isInsideUi(event.target)) return;
    hideToolbar();
    closePanel();
  }

  function onKeyDown(event) {
    if (!state.enabled) return;
    if (event.key === "Escape") {
      hideToolbar();
      closePanel();
    }
  }

  function onScroll(event) {
    if (!state.enabled) return;
    // No tanquem si l'scroll passa dins de la nostra UI (per ex. llista de sinònims).
    if (event.target && isInsideUi(event.target)) return;
    // Si l'usuari fa scroll a la pàgina, amaguem el toolbar però mantenim el panell.
    hideToolbar();
  }

  function onResize() {
    hideToolbar();
    closePanel();
  }

  /* ── Construcció UI ─────────────────────────────────────────────────── */
  function ensureUi() {
    if (state.root) return;

    const root = document.createElement("div");
    root.className = "insp-root";

    const toolbar = document.createElement("div");
    toolbar.className = "insp-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Inspecciona");

    const btnCorrect  = createIconButton("correct",  ICONS.correct,  "Corregeix");
    const btnSynonyms = createIconButton("synonyms", ICONS.synonyms, "Sinònims");
    const btnVariant  = createIconButton("variant",  ICONS.variant,  "Varietat dialectal");

    toolbar.append(btnCorrect, btnSynonyms, btnVariant);

    const panel = document.createElement("section");
    panel.className = "insp-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Inspecciona");

    const header = document.createElement("header");
    header.className = "insp-panel-header";

    const title = document.createElement("strong");
    title.className = "insp-panel-title";
    title.textContent = "Inspecciona";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "insp-panel-close";
    close.setAttribute("aria-label", "Tanca");
    close.innerHTML = ICONS.close;
    close.addEventListener("click", () => {
      closePanel();
      hideToolbar();
    });

    header.append(title, close);

    const body = document.createElement("div");
    body.className = "insp-panel-body";

    const preview = document.createElement("div");
    preview.className = "insp-preview";

    const status = document.createElement("p");
    status.className = "insp-status";

    const actions = document.createElement("div");
    actions.className = "insp-actions";

    const results = document.createElement("div");
    results.className = "insp-results";

    body.append(preview, status, actions, results);
    panel.append(header, body);

    root.append(toolbar, panel);
    document.documentElement.appendChild(root);

    state.root = root;
    state.toolbar = toolbar;
    state.toolbarButtons = { correct: btnCorrect, synonyms: btnSynonyms, variant: btnVariant };
    state.panel = panel;
    state.panelTitle = title;
    state.panelPreview = preview;
    state.panelStatus = status;
    state.panelActions = actions;
    state.panelResults = results;

    btnCorrect.addEventListener("click", openCorrectionPanel);
    btnSynonyms.addEventListener("click", openSynonymsPanel);
    btnVariant.addEventListener("click", openVariantPanel);

    header.addEventListener("mousedown", onPanelDragStart);
  }

  function createIconButton(action, svg, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "insp-toolbar-btn";
    button.dataset.insp = action;
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = svg;
    return button;
  }

  /* ── Toolbar ─────────────────────────────────────────────────────────── */
  function showToolbar(rect, allowSynonyms) {
    ensureUi();
    if (!state.toolbar || !rect) return;

    state.toolbarButtons.synonyms.hidden = !allowSynonyms;
    state.toolbar.classList.add("is-open");

    requestAnimationFrame(() => {
      const width = state.toolbar.offsetWidth || 140;
      const height = state.toolbar.offsetHeight || 40;

      let left = window.scrollX + rect.left + (rect.width / 2) - (width / 2);
      let top = window.scrollY + rect.top - height - 10;

      if (top < window.scrollY + 8) top = window.scrollY + rect.bottom + 10;

      const minLeft = window.scrollX + 8;
      const maxLeft = window.scrollX + document.documentElement.clientWidth - width - 8;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      state.toolbar.style.left = `${left}px`;
      state.toolbar.style.top  = `${top}px`;
    });
  }

  function hideToolbar() {
    state.toolbar?.classList.remove("is-open");
  }

  /* ── Panell ─────────────────────────────────────────────────────────── */
  function openPanel(title, rect) {
    if (!state.panel) return;
    resetPanel();
    state.panelTitle.textContent = title;
    state.panel.classList.add("is-open");
    hideToolbar();
    placePanel(rect);
  }

  function closePanel() {
    unwrapAnchor();
    state.panel?.classList.remove("is-open");
  }

  function isPanelOpen() {
    return Boolean(state.panel && state.panel.classList.contains("is-open"));
  }

  function resetPanel() {
    state.panelStatus.textContent = "";
    state.panelPreview.textContent = "";
    state.panelActions.replaceChildren();
    state.panelResults.replaceChildren();
    state.matchFilter = "all";
    state.lastMatches = [];
    state.dismissed = new Set();
    state.panelDragged = false;
  }

  function placePanel(rect) {
    if (!state.panel || !rect) return;
    if (state.panelDragged) return;

    requestAnimationFrame(() => {
      const width  = state.panel.offsetWidth  || 380;
      const height = state.panel.offsetHeight || 240;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      // Prefer placing the panel OUTSIDE the editable target element bounds
      // so it doesn't cover the text being corrected.
      const targetRect = state.selection?.target?.getBoundingClientRect?.();
      const anchorBottom = targetRect ? Math.max(rect.bottom, targetRect.bottom) : rect.bottom;
      const anchorTop    = targetRect ? Math.min(rect.top,    targetRect.top)    : rect.top;

      let left = window.scrollX + rect.left + (rect.width / 2) - (width / 2);
      let top  = window.scrollY + anchorBottom + 16;

      const viewportBottom = window.scrollY + viewportHeight - 8;
      if (top + height > viewportBottom) {
        top = window.scrollY + anchorTop - height - 16;
      }

      const minLeft = window.scrollX + 8;
      const maxLeft = window.scrollX + viewportWidth - width - 8;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      const minTop = window.scrollY + 8;
      const maxTop = window.scrollY + viewportHeight - height - 8;
      top = maxTop < minTop
        ? minTop
        : Math.max(minTop, Math.min(top, maxTop));

      state.panel.style.left = `${left}px`;
      state.panel.style.top  = `${top}px`;
    });
  }

  function setStatus(message, kind) {
    state.panelStatus.textContent = message || "";
    state.panelStatus.dataset.kind = kind || "";
  }

  /* ── Corrector ──────────────────────────────────────────────────────── */
  function openCorrectionPanel() {
    if (!state.selection?.target) return;
    state.workingText = state.selection.text;
    openPanel("Correcció", state.selection.rect);
    state.panelPreview.textContent = state.workingText;
    setStatus("Revisant…", "loading");
    runCheck();
  }

  async function runCheck() {
    const text = (state.workingText || "").trim();
    if (!text) {
      setStatus("No hi ha text per revisar.", "warn");
      return;
    }

    const response = await H.sendMessage({
      type: "inspecciona:check",
      text: state.workingText,
      variant: state.prefs.variant,
      prefs: state.prefs
    });

    if (!response.ok) {
      setStatus(response.error || "No s'ha pogut completar la correcció.", "error");
      return;
    }

    renderCorrections(response.data);
  }

  function renderCorrections(data) {
    const allMatches = (data?.matches || []).filter(
      (match) => Number.isInteger(match.offset) && Number.isInteger(match.length) && match.length > 0
    );
    allMatches.forEach((match, index) => { match.__id = index; });
    state.lastMatches = allMatches;

    renderPreviewWithMarks(state.workingText, allMatches);
    state.panelResults.replaceChildren();
    renderMatchFilters();

    const visible = allMatches.filter((match) => !state.dismissed.has(matchKey(match)));
    const filtered = visible.filter((match) => matchPassesFilter(match));

    if (allMatches.length === 0) {
      setStatus("Cap error detectat.", "ok");
      return;
    }

    if (visible.length === 0) {
      setStatus("Has descartat totes les incidències.", "ok");
      return;
    }

    if (filtered.length === 0) {
      setStatus("No hi ha incidències del tipus seleccionat.", "info");
      return;
    }

    setStatus(`${filtered.length} ${filtered.length === 1 ? "incidència" : "incidències"}.`, "info");

    for (const match of filtered.slice(0, 50)) {
      state.panelResults.appendChild(buildMatchRow(match));
    }
  }

  function renderMatchFilters() {
    if (!state.panelActions) return;

    const filters = [
      { value: "all", label: "Tots" },
      { value: "spelling", label: "Ortogràfics" },
      { value: "grammar", label: "Gramaticals" }
    ];

    const controls = document.createElement("div");
    controls.className = "insp-filters";

    for (const filter of filters) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "insp-btn insp-btn-ghost";
      button.textContent = filter.label;
      button.setAttribute("aria-pressed", String(state.matchFilter === filter.value));
      if (state.matchFilter === filter.value) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => {
        if (state.matchFilter === filter.value) return;
        state.matchFilter = filter.value;
        renderCorrections({ matches: state.lastMatches });
      });
      controls.appendChild(button);
    }

    state.panelActions.replaceChildren(controls);
  }

  function matchPassesFilter(match) {
    if (state.matchFilter === "all") return true;
    const kind = categorizeMatch(match);
    if (state.matchFilter === "spelling") return kind === "typo";
    if (state.matchFilter === "grammar") return kind !== "typo";
    return true;
  }

  function highlightMatch(id, on) {
    if (!Number.isInteger(id) || !state.panelPreview) return;
    const mark = state.panelPreview.querySelector(`.insp-mark[data-match-id="${id}"]`);
    if (!mark) return;
    mark.classList.toggle("is-hover", on);
    if (on) {
      mark.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function matchKey(match) {
    const slice = state.workingText.slice(match.offset, match.offset + match.length);
    return `${slice}::${match.message || ""}`;
  }

  function categorizeMatch(match) {
    const catId  = (match?.rule?.category?.id  || "").toUpperCase();
    const issue  = (match?.rule?.issueType     || "").toLowerCase();
    const ruleId = (match?.rule?.id            || "").toUpperCase();

    if (catId === "TYPOS" || ruleId.startsWith("MORFOLOGIK") || issue === "misspelling") {
      return "typo";
    }
    if (catId === "STYLE" || catId === "REDUNDANCY" || catId === "COLLOCATIONS" || issue === "style") {
      return "style";
    }
    return "grammar";
  }

  function renderPreviewWithMarks(text, matches) {
    state.panelPreview.replaceChildren();

    const sorted = [...matches].sort((a, b) => a.offset - b.offset);
    let cursor = 0;

    for (const match of sorted) {
      const start = Math.max(cursor, match.offset);
      const end   = Math.min(text.length, match.offset + match.length);
      if (end <= start) continue;

      if (start > cursor) {
        state.panelPreview.appendChild(document.createTextNode(text.slice(cursor, start)));
      }

      const marker = document.createElement("mark");
      marker.className = "insp-mark";
      marker.dataset.kind = categorizeMatch(match);
      if (Number.isInteger(match.__id)) {
        marker.dataset.matchId = String(match.__id);
      }
      marker.textContent = text.slice(start, end);
      state.panelPreview.appendChild(marker);

      cursor = end;
    }

    if (cursor < text.length) {
      state.panelPreview.appendChild(document.createTextNode(text.slice(cursor)));
    }

    if (state.panelPreview.childNodes.length === 0) {
      state.panelPreview.textContent = text;
    }
  }

  function buildMatchRow(match) {
    const row = document.createElement("div");
    row.className = "insp-match";
    row.dataset.kind = categorizeMatch(match);
    if (Number.isInteger(match.__id)) {
      row.dataset.matchId = String(match.__id);
    }
    row.addEventListener("mouseenter", () => highlightMatch(match.__id, true));
    row.addEventListener("mouseleave", () => highlightMatch(match.__id, false));

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "insp-match-dismiss";
    dismiss.setAttribute("aria-label", "Descarta aquesta incidència");
    dismiss.dataset.tooltip = "Descarta";
    dismiss.innerHTML = ICONS.close;
    dismiss.addEventListener("click", () => {
      state.dismissed.add(matchKey(match));
      renderCorrections({ matches: state.lastMatches });
    });

    const message = document.createElement("p");
    message.className = "insp-match-message";
    message.textContent = match.message || "Possibilitat de millora";

    const fragment = document.createElement("p");
    fragment.className = "insp-match-fragment";
    fragment.textContent = `«${state.workingText.slice(match.offset, match.offset + match.length)}»`;

    row.append(dismiss, message, fragment);

    const replacements = (match.replacements || []).slice(0, 5);
    if (replacements.length > 0) {
      const list = document.createElement("div");
      list.className = "insp-chips";
      for (const rep of replacements) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "insp-chip";
        chip.textContent = rep.value;
        chip.addEventListener("click", () => applySingleReplacement(match.offset, match.length, rep.value));
        list.appendChild(chip);
      }
      row.appendChild(list);
    }

    return row;
  }

  function applySingleReplacement(offset, length, replacement) {
    if (!state.selection?.target) return;

    // Si la fila de suggeriments és antiga (per una revisió prèvia),
    // ignorem l'acció per evitar corrupció del text seleccionat.
    if (!Number.isInteger(offset) || !Number.isInteger(length) || length <= 0) {
      setStatus("S'ha desactualitzat la revisió. Tornant a calcular…", "warn");
      runCheck();
      return;
    }

    if (offset < 0 || (offset + length) > state.workingText.length) {
      setStatus("S'ha desactualitzat la revisió. Tornant a calcular…", "warn");
      runCheck();
      return;
    }

    state.workingText = H.replaceTextSlice(state.workingText, offset, length, replacement);

    applyWorkingTextToSelection();
    // No buidem la llista actual: la deixem fins que arribin els nous
    // resultats per evitar el parpelleig entre l'aplicació i la revisió.
    setStatus("Revisant…", "loading");
    runCheck();
  }

  /* ── Sinònims ───────────────────────────────────────────────────────── */
  async function openSynonymsPanel() {
    if (!state.selection?.text || !H.isSingleWord(state.selection.text)) return;

    openPanel(`Sinònims de «${state.selection.text}»`, state.selection.rect);
    setStatus("Cercant…", "loading");

    const response = await H.sendMessage({
      type: "inspecciona:synonyms",
      word: state.selection.text
    });

    if (!response.ok) {
      setStatus(response.error || "No s'ha pogut cercar.", "error");
      return;
    }

    renderSynonyms(response.data);
  }

  function renderSynonyms(data) {
    const words = H.uniqueSynonymWords(data?.results || []);

    if (!words.length) {
      setStatus("No s'han trobat sinònims per a aquesta paraula.", "info");
      return;
    }

    setStatus(`${words.length} ${words.length === 1 ? "sinònim" : "sinònims"}.`, "info");

    const list = document.createElement("div");
    list.className = "insp-synonyms";

    for (const word of words) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "insp-chip";
      chip.textContent = word;
      chip.addEventListener("click", () => replaceSelectionWithWord(word));
      list.appendChild(chip);
    }

    state.panelResults.replaceChildren(list);
  }

  function replaceSelectionWithWord(word) {
    if (!state.selection?.target) return;

    state.workingText = word;
    state.selection.text = state.workingText;
    applyWorkingTextToSelection();

    closePanel();
    hideToolbar();
  }

  function applyWorkingTextToSelection() {
    if (!state.selection?.target) return;

    if (state.selection.kind === "text-control") {
      const input = state.selection.target;
      const full = input.value;
      const start = state.selection.start;
      const end = state.selection.end;

      const next = full.slice(0, start) + state.workingText + full.slice(end);
      input.value = next;
      input.selectionStart = start;
      input.selectionEnd = start + state.workingText.length;

      state.selection.end = input.selectionEnd;

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const target = state.selection.target;

    // Estratègia per contenteditable: substituïm la selecció inicial per un
    // <span data-insp-anchor> i, a partir d'aquí, cada nova correcció només
    // actualitza el textContent del span. És robust davant de qualsevol
    // mutació del DOM que faci l'editor (Gmail, etc.).
    if (state.selection.anchor && state.selection.anchor.isConnected) {
      state.selection.anchor.textContent = state.workingText;
    } else {
      const range = state.selection.range;
      if (!range || !range.startContainer?.isConnected) {
        setStatus("La selecció ja no és vàlida. Torna a seleccionar el fragment.", "warn");
        return;
      }
      range.deleteContents();
      const span = document.createElement("span");
      span.setAttribute("data-insp-anchor", "");
      span.textContent = state.workingText;
      range.insertNode(span);
      state.selection.anchor = span;
    }

    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function unwrapAnchor() {
    const anchor = state.selection?.anchor;
    if (!anchor) return;
    if (anchor.isConnected) {
      const textNode = document.createTextNode(anchor.textContent || "");
      anchor.replaceWith(textNode);
    }
    state.selection.anchor = null;
  }

  /* ── Varietat dialectal ─────────────────────────────────────────────── */
  function openVariantPanel() {
    if (!state.selection) return;

    openPanel("Varietat dialectal", state.selection.rect);
    setStatus("Tria la varietat per a les properes correccions.", "info");

    const options = [
      { value: "general",  label: "Catalan general (centrals)" },
      { value: "valencia", label: "Valencianes" },
      { value: "balear",   label: "Balears" }
    ];

    const wrap = document.createElement("div");
    wrap.className = "insp-options";

    for (const option of options) {
      const id = `insp-variant-${option.value}`;
      const row = document.createElement("label");
      row.className = "insp-option";
      row.htmlFor = id;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "insp-variant";
      input.id = id;
      input.value = option.value;
      input.checked = state.prefs.variant === option.value;

      const text = document.createElement("span");
      text.textContent = option.label;

      row.append(input, text);
      wrap.appendChild(row);
    }

    state.panelResults.replaceChildren(wrap);

    const save = document.createElement("button");
    save.type = "button";
    save.className = "insp-btn insp-btn-primary";
    save.textContent = "Desa varietat";
    save.addEventListener("click", () => {
      const value = wrap.querySelector('input[name="insp-variant"]:checked')?.value;
      if (!value) {
        setStatus("Tria una varietat.", "warn");
        return;
      }
      chrome.storage.sync.set({ variant: value }, () => {
        state.prefs.variant = value;
        setStatus("Varietat desada.", "ok");
        window.setTimeout(closePanel, 600);
      });
    });

    state.panelActions.replaceChildren(save);
  }

  /* ── Helpers locals ─────────────────────────────────────────────────── */
  function isInsideUi(target) {
    return Boolean(state.root && target && state.root.contains(target));
  }

  function readEditableSelection(eventTarget) {
    const editable = H.isEditableTarget(eventTarget) || H.isEditableTarget(document.activeElement);
    if (!editable) return null;

    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      const start = editable.selectionStart ?? 0;
      const end   = editable.selectionEnd ?? 0;
      if (end <= start) return null;

      const text = editable.value.slice(start, end);
      if (!text.trim()) return null;

      return {
        kind: "text-control",
        text,
        start,
        end,
        rect: editable.getBoundingClientRect(),
        target: editable
      };
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const text = selection.toString();
    if (!text.trim()) return null;

    const anchorEditable = H.isEditableTarget(selection.anchorNode);
    if (anchorEditable !== editable) return null;

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if ((!rect || rect.width === 0) && range.getClientRects().length > 0) {
      rect = range.getClientRects()[0];
    }
    if (!rect) return null;

    return {
      kind: "contenteditable",
      text,
      range: range.cloneRange(),
      rect,
      target: editable
    };
  }

  /* ── Drag del panell ────────────────────────────────────────────────── */
  function onPanelDragStart(event) {
    if (event.button !== 0) return;
    // No iniciem drag si l'usuari ha clicat el botó de tancar.
    if (event.target.closest(".insp-panel-close")) return;

    const rect = state.panel.getBoundingClientRect();
    state.drag = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startLeft: rect.left + window.scrollX,
      startTop: rect.top + window.scrollY
    };

    state.panel.classList.add("is-dragging");
    document.addEventListener("mousemove", onPanelDragMove, true);
    document.addEventListener("mouseup", onPanelDragEnd, true);
    event.preventDefault();
  }

  function onPanelDragMove(event) {
    if (!state.drag) return;
    const dx = event.clientX - state.drag.pointerX;
    const dy = event.clientY - state.drag.pointerY;

    const width = state.panel.offsetWidth;
    const height = state.panel.offsetHeight;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - width - 4;
    const maxTop  = window.scrollY + document.documentElement.clientHeight - height - 4;

    const left = Math.max(window.scrollX + 4, Math.min(state.drag.startLeft + dx, maxLeft));
    const top  = Math.max(window.scrollY + 4, Math.min(state.drag.startTop  + dy, maxTop));

    state.panel.style.left = `${left}px`;
    state.panel.style.top  = `${top}px`;
    state.panelDragged = true;
  }

  function onPanelDragEnd() {
    state.drag = null;
    state.panel.classList.remove("is-dragging");
    document.removeEventListener("mousemove", onPanelDragMove, true);
    document.removeEventListener("mouseup", onPanelDragEnd, true);
  }
})();
