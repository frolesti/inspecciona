(function () {
  const H = window.InspeccionaHelpers;
  if (!H) return;

  /* ── Icones SVG (inline, una sola línia per facilitat de manteniment) ── */
  const ICONS = {
    synonyms: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg>',
    dictionary: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a3 3 0 0 1 3-3h5v17H6a3 3 0 0 0-3 3V6Z"/><path d="M21 6a3 3 0 0 0-3-3h-5v17h5a3 3 0 0 1 3 3V6Z"/><path d="M11 5a2 2 0 0 0-2-2"/><path d="M13 5a2 2 0 0 1 2-2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-.06-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6c.36 0 .7-.12 1-.33.27-.2.46-.5.53-.84V3a2 2 0 1 1 4 0v.09c.07.34.26.64.53.84.3.21.64.33 1 .33a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.6 1.14-.33 1.82.1.25.25.47.44.65.19.18.42.33.68.43H21a2 2 0 1 1 0 4h-.09c-.26.1-.49.25-.68.43-.19.18-.34.4-.44.65Z"/></svg>',
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
    drag: null,
    inlineMarker: null,
    inlineMarkerTooltip: null,
    inlineLiveLayer: null,
    inlineLiveMatches: [],
    inlineLiveText: "",
    inlinePopup: null,
    inlineIgnored: new Set(),
    inlineReviewTimer: null,
    inlinePopupTimer: null,
    inlineReviewSeq: 0
  };

  const LIVE_INPUT_DEBOUNCE_MS = 480;

  const inlineUtils = window.InspeccionaInlineUtils || {
     classifyMatchKind: (match) => {
      const catId = (match?.rule?.category?.id || "").toUpperCase();
      const issue = (match?.rule?.issueType || "").toLowerCase();
      const ruleId = (match?.rule?.id || "").toUpperCase();

      if (catId === "TYPOS" || ruleId.startsWith("MORFOLOGIK") || issue === "misspelling") {
        return "typo";
      }
      if (catId === "STYLE" || catId === "REDUNDANCY" || catId === "COLLOCATIONS" || issue === "style") {
        return "style";
      }
      return "grammar";
    },
    getMarkerStyles: (kind) => ({
        typo: { color: "#c0392b", label: "Ortografia" },
      grammar: { color: "#2c5d8a", label: "Gramàtica" },
      style: { color: "#1f5f3e", label: "Estil" }
    }[kind] || { color: "#2c5d8a", label: "Gramàtica" })
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
    document.addEventListener("input", onInputChange, true);
    document.addEventListener("compositionend", onInputChange, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
  }

  function onMouseUp(event) {
    if (!state.enabled) return;
    if (isInsideUi(event.target)) return;

    window.setTimeout(() => {
      const next = readEditableSelection(event.target);
      if (!next) {
        hideInlineMarker();
        if (!isPanelOpen()) hideToolbar();
        return;
      }
      if (!state.inlineLiveLayer && !state.inlineMarker) state.selection = next;
      if (!isPanelOpen()) showToolbar(next.rect);
    }, 0);
  }

  function onPointerDown(event) {
    if (!state.enabled) return;
    if (isInsideUi(event.target)) return;
    hideToolbar();
    closePanel();
    if (findEditable(event.target) !== state.selection?.target) hideInlineReview();
  }

  function onKeyDown(event) {
    if (!state.enabled) return;
    if (event.key === "Escape") {
      hideToolbar();
      closePanel();
      hideInlineReview();
    }
  }

  function onInputChange(event) {
    if (!state.enabled) return;
    if (isInsideUi(event.target)) return;
    if (!findEditable(event.target)) return;
    hideInlineReview();
    if (state.inlineReviewTimer) window.clearTimeout(state.inlineReviewTimer);
    if (event.isComposing) return;
    state.inlineReviewTimer = window.setTimeout(() => {
      const next = readEditableSnapshot(event.target);
      if (!next) {
        hideInlineReview();
        return;
      }
      if (next.kind !== "contenteditable") {
        state.selection = next;
        hideInlineReview();
        return;
      }
      state.selection = next;
      runInlineReview(next, { live: true });
    }, LIVE_INPUT_DEBOUNCE_MS);
  }

  function onScroll(event) {
    if (!state.enabled) return;
    // No tanquem si l'scroll passa dins de la nostra UI (per ex. llista de sinònims).
    if (event.target && isInsideUi(event.target)) return;
    // Si l'usuari fa scroll a la pàgina, amaguem el toolbar però mantenim el panell.
    hideToolbar();
    positionInlineMarker();
    positionLiveReviewLayer();
    hideInlinePopup();
  }

  function onResize() {
    hideToolbar();
    closePanel();
    hideInlineReview();
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

    const btnSynonyms = createIconButton("synonyms", ICONS.synonyms, "Sinònims");
    const btnDictionary = createIconButton("dictionary", ICONS.dictionary, "Diccionari");
    const btnSettings = createIconButton("settings", ICONS.settings, "Configuració");

    toolbar.append(btnSynonyms, btnDictionary, btnSettings);

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

    // CRÍTIC: cap dels nostres controls no ha de robar el focus al camp
    // editable. Si el focus surt del contenteditable, editors rics com
    // DraftJS (X/Twitter) marquen internament la selecció com a col·lapsada
    // i qualsevol execCommand posterior insereix sense esborrar el text
    // original → duplicacions. Amb preventDefault al mousedown, el botó
    // rep el 'click' però el focus queda al camp de text de l'usuari.
    root.addEventListener("mousedown", (event) => {
      const btn = event.target.closest("button, .insp-chip");
      if (btn) event.preventDefault();
    });

    state.root = root;
    state.toolbar = toolbar;
    state.toolbarButtons = { synonyms: btnSynonyms, dictionary: btnDictionary, settings: btnSettings };
    state.panel = panel;
    state.panelTitle = title;
    state.panelPreview = preview;
    state.panelStatus = status;
    state.panelActions = actions;
    state.panelResults = results;

    btnSynonyms.addEventListener("click", openSynonymsPanel);
    btnDictionary.addEventListener("click", openDictionaryPanel);
    btnSettings.addEventListener("click", openSettingsPage);

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
  function showToolbar(rect) {
    ensureUi();
    if (!state.toolbar || !rect) return;

    // Els sinònims han d'estar sempre disponibles, encara que no hi hagi
    // una selecció d'una sola paraula en aquell instant.
    state.toolbarButtons.synonyms.hidden = false;
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

  function hideInlineMarker() {
    state.inlineMarker?.remove();
    state.inlineMarker = null;
    state.inlineMarkerTooltip?.remove();
    state.inlineMarkerTooltip = null;
  }

  function hideInlinePopup() {
    state.inlinePopup?.remove();
    state.inlinePopup = null;
    if (state.inlinePopupTimer) window.clearTimeout(state.inlinePopupTimer);
    state.inlinePopupTimer = null;
  }

  function hideInlineReview() {
    state.inlineReviewSeq++;
    hideInlineMarker();
    hideInlinePopup();
    state.inlineLiveLayer?.remove();
    state.inlineLiveLayer = null;
    state.inlineLiveMatches = [];
    state.inlineLiveText = "";
    if (state.inlinePopupTimer) window.clearTimeout(state.inlinePopupTimer);
    state.inlinePopupTimer = null;
  }

  function positionLiveReviewLayer() {
    if (!state.inlineLiveLayer) return;
    if (state.selection?.kind !== "contenteditable") return;
    if (!Array.isArray(state.inlineLiveMatches) || state.inlineLiveMatches.length === 0) return;
    if (!state.selection?.target || !state.selection.target.isConnected) return;

    const fresh = readContentEditableSnapshot(state.selection.target);
    if (!fresh || fresh.kind !== "contenteditable" || fresh.text !== state.inlineLiveText) {
      hideInlineReview();
      return;
    }

    state.selection = fresh;

    const hits = Array.from(state.inlineLiveLayer.querySelectorAll(".insp-live-hit"));
    for (const hit of hits) {
      const matchIndex = Number.parseInt(hit.dataset.matchIndex || "", 10);
      const rectIndex = Number.parseInt(hit.dataset.rectIndex || "", 10);
      const match = state.inlineLiveMatches[matchIndex];

      if (!match || !Number.isInteger(rectIndex) || rectIndex < 0) {
        hit.style.display = "none";
        continue;
      }

      const range = buildLiveRangeFromOffsets(fresh.target, fresh.segments, match.offset, match.length);
      if (!range) {
        hit.style.display = "none";
        continue;
      }

      const rects = fresh.segments.flatMap((segment) => {
        const start = Math.max(match.offset, segment.textStart);
        const end = Math.min(match.offset + match.length, segment.textStart + segment.len);
        if (end <= start) return [];
        const fragment = document.createRange();
        fragment.setStart(segment.node, segment.nodeOffset + start - segment.textStart);
        fragment.setEnd(segment.node, segment.nodeOffset + end - segment.textStart);
        return Array.from(fragment.getClientRects()).filter((entry) => entry.width > 0 && entry.height > 0);
      });
      const rect = rects[rectIndex];
      if (!rect) {
        hit.style.display = "none";
        continue;
      }

      hit.style.display = "";
      hit.style.left = `${window.scrollX + rect.left}px`;
      hit.style.top = `${window.scrollY + rect.top - 4}px`;
      hit.style.height = `${Math.max(16, rect.height + 8)}px`;
      hit.style.width = `${rect.width}px`;
    }
  }

  function positionInlineMarker() {
    if (!state.inlineMarker || !state.selection?.rect) return;

    const rect = state.selection.rect;
    const left = window.scrollX + rect.left;
    const top = window.scrollY + rect.bottom + 8;
    state.inlineMarker.style.left = `${left}px`;
    state.inlineMarker.style.top = `${top}px`;
  }

  async function runInlineReview(selection, options = {}) {
    if (!selection?.target || !selection.text?.trim()) {
      hideInlineReview();
      return;
    }

    const seq = ++state.inlineReviewSeq;
    ensureUi();
    const response = await H.sendMessage({
      type: "inspecciona:check",
      text: selection.text,
      variant: state.prefs.variant,
      prefs: state.prefs
    });

    if (seq !== state.inlineReviewSeq) return;
    if (state.selection?.target !== selection.target) return;

    if (!response.ok) {
      hideInlineReview();
      return;
    }

    if (options.live) {
      const fresh = readContentEditableSnapshot(selection.target);
      if (!fresh || fresh.text !== selection.text) return;
      selection = fresh;
    } else if (state.selection !== selection) {
      return;
    }
    state.selection = selection;
    state.workingText = selection.text;

    if (options.live) {
      renderLiveReview(selection, response.data);
      return;
    }

    renderInlineMarker(selection, response.data);
  }

  function renderLiveReview(selection, data) {
    hideInlinePopup();
    state.inlineLiveLayer?.remove();

    const matches = normalizeMatches(data?.matches || [], selection.text);
    state.inlineLiveMatches = matches;
    state.inlineLiveText = selection.text;
    if (!matches.length) return;

    const firstMatch = matches[0];
    const firstKind = inlineUtils.classifyMatchKind(firstMatch);
    const firstSuggestion = getFirstSuggestion(firstMatch);
    const firstPopupText = buildPopupText(firstMatch, firstKind, firstSuggestion);
    const firstMatchKey = buildLiveMatchKey(selection.text, firstMatch);

    if (selection.kind !== "contenteditable") {
      const fallbackLayer = document.createElement("div");
      fallbackLayer.className = "insp-live-layer";
      state.inlineLiveLayer = fallbackLayer;
      state.root.appendChild(fallbackLayer);
      showInlinePopup(selection.rect, firstPopupText, firstSuggestion, firstKind, firstMatch, firstMatchKey);
      return;
    }

    const layer = document.createElement("div");
    layer.className = "insp-live-layer";
    state.inlineLiveLayer = layer;
    state.root.appendChild(layer);

    for (const match of matches.slice(0, 50)) {
      const matchIndex = matches.indexOf(match);
      const range = buildLiveRangeFromOffsets(selection.target, selection.segments, match.offset, match.length);
      if (!range) continue;

      const kind = inlineUtils.classifyMatchKind(match);
      const suggestion = getFirstSuggestion(match);
      const popupText = buildPopupText(match, kind, suggestion);
      const matchKey = buildLiveMatchKey(selection.text, match);
      const rects = selection.segments.flatMap((segment) => {
        const start = Math.max(match.offset, segment.textStart);
        const end = Math.min(match.offset + match.length, segment.textStart + segment.len);
        if (end <= start) return [];
        const fragment = document.createRange();
        fragment.setStart(segment.node, segment.nodeOffset + start - segment.textStart);
        fragment.setEnd(segment.node, segment.nodeOffset + end - segment.textStart);
        return Array.from(fragment.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
      });

      rects.forEach((rect, rectIndex) => {
        const hit = document.createElement("button");
        hit.type = "button";
        hit.className = "insp-live-hit";
        hit.dataset.kind = kind;
        hit.dataset.matchKey = matchKey;
        hit.dataset.matchIndex = String(matchIndex);
        hit.dataset.rectIndex = String(rectIndex);
        hit.style.left = `${window.scrollX + rect.left}px`;
        hit.style.top = `${window.scrollY + rect.top - 4}px`;
        hit.style.height = `${Math.max(16, rect.height + 8)}px`;
        hit.style.width = `${rect.width}px`;

        const line = document.createElement("span");
        line.className = "insp-live-hit-line";
        hit.appendChild(line);

        if (state.inlineIgnored.has(matchKey)) {
          hit.classList.add("is-ignored");
        }

        hit.addEventListener("mouseenter", () => {
          if (state.inlineIgnored.has(matchKey)) return;
          showInlinePopup(hit, popupText, suggestion, kind, match, matchKey);
        });
        hit.addEventListener("mouseleave", scheduleHideInlinePopup);
        hit.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          showInlinePopup(hit, popupText, suggestion, kind, match, matchKey);
        });

        layer.appendChild(hit);
      });
    }
  }

  function showInlinePopup(anchor, popupText, suggestion, kind, match, matchKey = "") {
    hideInlinePopup();

    const popup = document.createElement("div");
    popup.className = "insp-inline-popup";
    popup.dataset.kind = kind;

    const title = document.createElement("strong");
    title.textContent = popupText.title;

    const message = document.createElement("p");
    message.textContent = popupText.message;

    const correction = document.createElement("p");
    correction.className = "insp-inline-popup-correction";
    correction.textContent = popupText.detail;

    const actions = document.createElement("div");
    actions.className = "insp-inline-popup-actions";

    if (suggestion) {
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "insp-btn insp-btn-primary";
      apply.textContent = "Aplica correcció";
      apply.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applySingleReplacement(match.offset, match.length, suggestion);
        hideInlineReview();
      });
      actions.appendChild(apply);
    }

    const ignore = document.createElement("button");
    ignore.type = "button";
    ignore.className = "insp-btn insp-btn-ghost";
    ignore.textContent = "Ignora";
    ignore.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (matchKey) addIgnoredLiveMatch(matchKey);
      hideInlinePopup();
    });
    actions.appendChild(ignore);

    popup.append(title, message, correction, actions);
    state.inlinePopup = popup;
    state.root.appendChild(popup);
    popup.addEventListener("mouseenter", () => {
      if (state.inlinePopupTimer) window.clearTimeout(state.inlinePopupTimer);
    });
    popup.addEventListener("mouseleave", scheduleHideInlinePopup);

    const rect = typeof anchor?.getBoundingClientRect === "function" ? anchor.getBoundingClientRect() : anchor;
    const popupHeight = popup.offsetHeight || 120;
    let top = window.scrollY + rect.top - popupHeight - 12;
    if (top < window.scrollY + 8) {
      top = window.scrollY + rect.bottom + 10;
    }
    popup.style.left = `${window.scrollX + rect.left}px`;
    popup.style.top = `${top}px`;
  }

  function scheduleHideInlinePopup() {
    if (state.inlinePopupTimer) window.clearTimeout(state.inlinePopupTimer);
    state.inlinePopupTimer = window.setTimeout(() => {
      hideInlinePopup();
    }, 120);
  }

  function normalizeMatches(matches, text = state.workingText) {
    return (matches || []).filter((match) => Number.isInteger(match.offset) && Number.isInteger(match.length) &&
      match.offset >= 0 && match.length > 0 && match.offset + match.length <= text.length);
  }

  function buildLiveMatchKey(sourceText, match) {
    const excerpt = String(sourceText || "").slice(match.offset, match.offset + match.length);
    return `${match.offset}:${match.length}:${excerpt}:${match.message || ""}`;
  }

  function addIgnoredLiveMatch(matchKey) {
    if (!matchKey) return;
    state.inlineIgnored.add(matchKey);
    if (state.inlineIgnored.size > 250) {
      const first = state.inlineIgnored.values().next().value;
      if (first) state.inlineIgnored.delete(first);
    }
  }

  function getFirstSuggestion(match) {
    return match?.replacements?.find((entry) => entry?.value)?.value || "";
  }

  function buildPopupText(match, kind, suggestion) {
    const titleMap = {
      typo: "Error ortogràfic",
      grammar: "Error gramatical",
      style: "Suggeriment d'estil"
    };
    const title = titleMap[kind] || "Incidència detectada";
    const rawMessage = match?.message?.trim() || match?.rule?.description?.trim() || "";
    const normalizedMessage = rawMessage && rawMessage.toLowerCase() !== title.toLowerCase()
      ? rawMessage
      : `S'ha detectat un possible ${kind === "typo" ? "error ortogràfic" : kind === "grammar" ? "error gramatical" : "millora d'estil"}.`;
    const detail = suggestion ? `Correcció recomanada: ${suggestion}` : "No hi ha cap correcció automàtica disponible.";
    return { title, message: normalizedMessage, detail };
  }

  function buildLiveRangeFromOffsets(editable, segments, offset, length) {
    if (!editable || !Array.isArray(segments) || !Number.isInteger(offset) || !Number.isInteger(length) || length <= 0) {
      return null;
    }

    const start = segmentAtTextOffset(segments, offset);
    const end = segmentAtTextOffset(segments, offset + length, true);
    if (!start || !end) return null;

    const absStart = start.nodeStart + (offset - start.textStart);
    const absEnd = end.nodeStart + (offset + length - end.textStart);
    return buildRangeFromOffsets(editable, absStart, absEnd);
  }

  function readEditableSnapshot(eventTarget) {
    const editable = findEditable(eventTarget) || findEditable(document.activeElement);
    if (!editable) return null;

    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      const value = editable.value || "";
      if (!value.trim()) return null;
      return {
        kind: "text-control",
        target: editable,
        text: value,
        start: 0,
        end: value.length,
        rect: editable.getBoundingClientRect(),
        segments: [],
        isSingleWord: isSingleWord(value)
      };
    }

    return readContentEditableSnapshot(editable);
  }

  function readContentEditableSnapshot(editable) {
    if (!editable) return null;

    const range = document.createRange();
    range.selectNodeContents(editable);
    const { text, segments } = collectSelectionSegments(editable, range);

    if (!text.trim() || segments.length === 0) return null;

    return {
      kind: "contenteditable",
      target: editable,
      text,
      segments,
      rect: editable.getBoundingClientRect(),
      isSingleWord: isSingleWord(text)
    };
  }

  function renderInlineMarker(selection, data) {
    hideInlineMarker();

    const matches = normalizeMatches(data?.matches || [], selection.text);

    if (!matches.length) return;

    const first = matches[0];
    const kind = inlineUtils.classifyMatchKind(first);
    const styles = inlineUtils.getMarkerStyles(kind);

    const marker = document.createElement("div");
    marker.className = "insp-inline-marker";
    marker.dataset.kind = kind;
    marker.style.left = `${window.scrollX + selection.rect.left}px`;
    marker.style.top = `${window.scrollY + selection.rect.bottom + 8}px`;

    const label = document.createElement("span");
    label.className = "insp-inline-marker-label";
    label.textContent = styles.label;

    const tooltip = document.createElement("div");
    tooltip.className = "insp-inline-marker-tooltip";

    const title = document.createElement("strong");
    title.textContent = styles.label;

    const hint = document.createElement("span");
    hint.textContent = first.replacements?.[0]?.value
      ? `Sugg.: ${first.replacements[0].value}`
      : "Suggeriment disponible";

    tooltip.append(title, hint);

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "insp-inline-marker-action";
    apply.textContent = "Aplicar";
    apply.addEventListener("click", (event) => {
      event.stopPropagation();
      applySingleReplacement(first.offset, first.length, first.replacements?.[0]?.value || "");
      hideInlineMarker();
    });

    tooltip.appendChild(apply);
    marker.append(label, tooltip);
    marker.addEventListener("mouseenter", () => marker.classList.add("is-hover"));
    marker.addEventListener("mouseleave", () => marker.classList.remove("is-hover"));
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      if (first.replacements?.[0]?.value) {
        applySingleReplacement(first.offset, first.length, first.replacements[0].value);
      }
      hideInlineMarker();
    });

    state.inlineMarker = marker;
    state.inlineMarkerTooltip = tooltip;
    state.root.appendChild(marker);
    positionInlineMarker();
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
    const allMatches = normalizeMatches(data?.matches || []);
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
    const row = state.panelResults?.querySelector(`.insp-match[data-match-id="${id}"]`);
    if (!mark) return;
    mark.classList.toggle("is-hover", on);
    row?.classList.toggle("is-hover", on);
    if (on) scrollMarkIntoPreview(mark);
  }

  function scrollMarkIntoPreview(mark) {
    const preview = state.panelPreview;
    if (!preview) return;
    const markRect = mark.getBoundingClientRect();
    const boxRect = preview.getBoundingClientRect();
    // Fem l'scroll només dins del propi contenidor de la vista prèvia,
    // sense propagar-lo al panell ni a la pàgina.
    if (markRect.top < boxRect.top) {
      preview.scrollTop -= (boxRect.top - markRect.top) + 4;
    } else if (markRect.bottom > boxRect.bottom) {
      preview.scrollTop += (markRect.bottom - boxRect.bottom) + 4;
    }
  }

  function matchKey(match) {
    const slice = state.workingText.slice(match.offset, match.offset + match.length);
    return `${slice}::${match.message || ""}`;
  }

  function categorizeMatch(match) {
    return inlineUtils.classifyMatchKind(match);
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

    const current = state.selection;
    if (current.kind === "contenteditable") {
      const segments = current.segments || [];
      const first = segments[0];
      const last = segments[segments.length - 1];
      const range = first && last && buildRangeFromOffsets(current.target, first.nodeStart, last.nodeStart + last.len);
      const collected = range && collectSelectionSegments(current.target, range);
      const reviewedNodes = segments.map((segment) => state.workingText.slice(segment.textStart, segment.textStart + segment.len)).join("");
      const currentNodes = collected?.segments.map((segment) => segment.node.nodeValue.slice(segment.nodeOffset, segment.nodeOffset + segment.len)).join("");
      if (!collected || currentNodes !== reviewedNodes || current.text !== state.workingText) {
        hideInlineReview();
        setStatus("La correcció ja no correspon al text actual.", "warn");
        return;
      }
      current.segments = collected.segments;
    } else if (current.target.value.slice(current.start, current.end) !== state.workingText) {
      hideInlineReview();
      return;
    }

    // Validem que l'incidència encara encaixa dins del text actual.
    if (!Number.isInteger(offset) || !Number.isInteger(length) || length <= 0 ||
        offset < 0 || (offset + length) > state.workingText.length) {
      hideInlineReview();
      setStatus("La correcció ja no correspon al text actual.", "warn");
      return;
    }

    if (state.selection.kind === "text-control") {
      replaceInTextControl(offset, length, replacement);
      const fresh = readEditableSnapshot(current.target);
      if (fresh) {
        state.selection = fresh;
        state.workingText = fresh.text;
      }
      return;
    }

    // Reduïm l'edició al fragment que realment canvia (prefix/sufix comuns).
    // Això és CLAU a X/Twitter: correccions com «però» → «, però» comparteixen
    // el sufix «però». Sense minimitzar, el rang inclouria l'espai anterior
    // (que pertany al node de la menció @usuari) i creuaria la frontera de
    // l'entitat de DraftJS, que aleshores insereix sense esborrar → duplica
    // («, però però»). Amb la minimització sovint queda una simple inserció.
    const matched = state.workingText.slice(offset, offset + length);
    const min = minimizeEdit(matched, replacement);
    const effOffset = offset + min.deltaStart;
    const effLength = min.deltaLen;
    const effReplacement = min.insert;

    const target = state.selection.target;
    const segments = state.selection.segments || [];
    const segStart = segmentAtTextOffset(segments, effOffset);
    const segEnd = segmentAtTextOffset(segments, effOffset + effLength, true);
    if (!segStart || !segEnd) {
      hideInlineReview();
      setStatus("No s'ha pogut localitzar el fragment de la correcció.", "warn");
      return;
    }

    const absStart = segStart.nodeStart + (effOffset - segStart.textStart);
    const absEnd = segEnd.nodeStart + (effOffset + effLength - segEnd.textStart);
    if (absEnd - absStart !== effLength) {
      setStatus("Aquesta correcció afecta salts de paràgraf i s'ha d'aplicar manualment.", "warn");
      return;
    }
    replaceInContentEditable(absStart, absEnd, effReplacement, (ok) => {
      if (!ok) {
        setStatus("L'editor no permet la inserció automàtica.", "warn");
        return;
      }

      const fresh = readContentEditableSnapshot(target);
      if (fresh) {
        state.selection = fresh;
        state.workingText = fresh.text;
      }
      onInputChange({ target });
    });
  }

  /* ── Sinònims ───────────────────────────────────────────────────────── */
  async function openSynonymsPanel() {
    const synonymSelection = resolveSynonymSelection();
    if (!synonymSelection) {
      if (state.selection?.rect) {
        openPanel("Sinònims", state.selection.rect);
        setStatus("Posa el cursor sobre una paraula per cercar sinònims.", "warn");
      }
      return;
    }

    state.selection = synonymSelection;

    openPanel(`Sinònims de «${synonymSelection.text}»`, synonymSelection.rect);
    setStatus("Cercant…", "loading");

    const response = await H.sendMessage({
      type: "inspecciona:synonyms",
      word: synonymSelection.text
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

    if (state.selection.kind === "text-control") {
      replaceInTextControl(0, state.selection.text.length, word);
    } else {
      const segments = state.selection.segments || [];
      if (segments.length) {
        const absStart = segments[0].nodeStart;
        const last = segments[segments.length - 1];
        replaceInContentEditable(absStart, last.nodeStart + last.len, word);
      }
    }

    closePanel();
    hideToolbar();
  }

  /* ── Reemplaçament de text ──────────────────────────────────────────── */
  function replaceInTextControl(offset, length, replacement) {
    const input = state.selection.target;
    const absStart = state.selection.start + offset;
    const value = input.value;
    const next = value.slice(0, absStart) + replacement + value.slice(absStart + length);

    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter) setter.call(input, next); else input.value = next;

    const caret = absStart + replacement.length;
    input.selectionStart = caret;
    input.selectionEnd = caret;

    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: replacement }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function replaceInContentEditable(absStart, absEnd, replacement, onDone) {
    const target = state.selection.target;
    if (!target || !target.isConnected) {
      setStatus("La selecció ja no és vàlida. Torna a seleccionar el fragment.", "warn");
      return;
    }

    const domRange = buildRangeFromOffsets(target, absStart, absEnd);
    if (!domRange) {
      setStatus("No s'ha pogut localitzar el text a substituir.", "warn");
      return;
    }

    const before = target.textContent;
    const expected = H.replaceTextSlice(before, absStart, absEnd - absStart, replacement);
    target.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(domRange);

    // Deixem que l'editor (DraftJS/React a X, ProseMirror...) sincronitzi la
    // seva selecció interna a partir de l'esdeveniment 'selectionchange'
    // ABANS d'inserir. Si inserim al mateix tick, alguns editors encara tenen
    // la selecció col·lapsada i afegeixen el text sense esborrar l'original
    // → duplicació. Un tick de marge ho resol.
    window.setTimeout(() => {
      let ok = false;
      try {
        if (!target.isConnected || target.textContent !== before || !target.contains(selection.anchorNode)) {
          if (onDone) onDone(false);
          return;
        }
        selection.removeAllRanges();
        selection.addRange(domRange);
        document.execCommand("insertText", false, replacement);
        ok = target.textContent === expected;
      } catch (error) {
        console.warn("[Inspecciona] insertText ha fallat:", error?.message || error);
      }
      if (onDone) onDone(ok);
    }, 0);
  }

  // Construeix un Range del DOM que cobreix [absStart, absEnd) en l'espai de
  // text de nodes de l'element editable (suma de nodeValue, SENSE salts de
  // línia sintètics). Aquest espai és consistent amb el que fem servir per
  // localitzar les correccions, i evita la deriva que provocava barrejar
  // Selection.toString() (amb salts) i Range.toString() (sense).
  //
  // IMPORTANT sobre les fronteres de node: quan una paraula comença just a
  // l'inici d'un paràgraf, el seu offset coincideix amb el FINAL del node del
  // paràgraf anterior (són adjacents en espai de text de nodes). Per a l'INICI
  // del rang preferim el node SEGÜENT (comparació estricta amb nodeEnd), i per
  // al FINAL el node ACTUAL. Així el rang no creua mai la frontera de blocs,
  // cosa que faria que insertText fusionés els paràgrafs.
  function buildRangeFromOffsets(root, absStart, absEnd) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node;
    let pos = 0;
    let lastNode = null;
    let startSet = false;

    while ((node = walker.nextNode())) {
      const nodeStart = pos;
      const nodeEnd = pos + node.nodeValue.length;

      if (!startSet && absStart >= nodeStart && absStart < nodeEnd) {
        range.setStart(node, absStart - nodeStart);
        startSet = true;
      }
      if (startSet && absEnd >= nodeStart && absEnd <= nodeEnd) {
        range.setEnd(node, absEnd - nodeStart);
        return range;
      }

      lastNode = node;
      pos = nodeEnd;
    }

    // Posicions que cauen exactament al final absolut del text.
    if (lastNode) {
      const end = lastNode.nodeValue.length;
      if (!startSet) range.setStart(lastNode, end);
      range.setEnd(lastNode, end);
      return range;
    }

    return null;
  }

  // Recull els fragments de text seleccionats dins d'un contenteditable.
  // Retorna { text, segments }, on `text` és el text de treball (amb salts de
  // línia entre blocs per llegibilitat i qualitat del corrector) i `segments`
  // mapeja cada tros a la seva posició al DOM:
  //   { node, nodeOffset, nodeStart, textStart, len }
  //   - nodeStart: offset absolut en espai de text de nodes (sense salts).
  //   - textStart: offset dins de `text` (amb salts).
  function collectSelectionSegments(editable, range) {
    const segments = [];
    let text = "";
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const blockOrder = getSelectedBlockOrder(editable, range);
    const blockIndex = new Map(blockOrder.map((block, idx) => [block, idx]));
    let node;
    let absPos = 0;
    let prevBlock = null;
    let first = true;
    let pendingBreaks = 0;

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === "BR" && range.intersectsNode(node)) pendingBreaks++;
        continue;
      }

      const len = node.nodeValue.length;
      if (range.intersectsNode(node)) {
        let s = 0;
        let e = len;
        if (node === range.startContainer) s = range.startOffset;
        if (node === range.endContainer) e = range.endOffset;

        if (e > s) {
          const slice = node.nodeValue.slice(s, e);
          const block = nearestBlock(node, editable);
          const prevIdx = blockIndex.get(prevBlock);
          const currIdx = blockIndex.get(block);
          const blockGap = !first && block !== prevBlock
            ? Number.isInteger(prevIdx) && Number.isInteger(currIdx)
              ? Math.max(1, currIdx - prevIdx)
              : 1
            : 0;
          const lineBreaks = Math.max(blockGap, pendingBreaks);
          if (lineBreaks > 0) text += "\n".repeat(lineBreaks);

          segments.push({
            node,
            nodeOffset: s,
            nodeStart: absPos + s,
            textStart: text.length,
            len: slice.length
          });
          text += slice;
          prevBlock = block;
          first = false;
          pendingBreaks = 0;
        }
      }
      absPos += len;
    }

    return { text, segments };
  }

  function nearestBlock(node, editable) {
    let el = node.parentElement;
    while (el && el !== editable) {
      if (isBlockElement(el)) return el;
      el = el.parentElement;
    }
    return editable;
  }

  function getSelectedBlockOrder(editable, range) {
    const blocks = [];
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      if (!isBlockElement(el)) continue;
      if (!range.intersectsNode(el)) continue;
      blocks.push(el);
    }
    return blocks.filter((block) => !blocks.some((other) => other !== block && block.contains(other)));
  }

  function isBlockElement(el) {
    return ["block", "list-item", "table", "table-row", "table-cell", "flex", "grid", "flow-root"]
      .includes(window.getComputedStyle(el).display);
  }

  function segmentAtTextOffset(segments, textOffset, preferEnd = false) {
    let boundary = null;
    for (const seg of segments) {
      if (textOffset >= seg.textStart && textOffset <= seg.textStart + seg.len) {
        if (textOffset < seg.textStart + seg.len || preferEnd) return seg;
        boundary = seg;
      }
    }
    return boundary;
  }

  // Redueix una substitució al fragment mínim que canvia realment, traient el
  // prefix i el sufix comuns entre el text original i el reemplaçament.
  // Retorna { deltaStart, deltaLen, insert }:
  //   - deltaStart: quants caràcters del principi es mantenen igual.
  //   - deltaLen: quants caràcters (després del prefix) cal esborrar.
  //   - insert: text a inserir en aquell punt.
  function minimizeEdit(matched, replacement) {
    matched = String(matched ?? "");
    replacement = String(replacement ?? "");

    let start = 0;
    const maxPrefix = Math.min(matched.length, replacement.length);
    while (start < maxPrefix && matched[start] === replacement[start]) start++;

    let endM = matched.length;
    let endR = replacement.length;
    while (endM > start && endR > start && matched[endM - 1] === replacement[endR - 1]) {
      endM--;
      endR--;
    }

    return {
      deltaStart: start,
      deltaLen: endM - start,
      insert: replacement.slice(start, endR)
    };
  }

  /* ── Diccionari ───────────────────────────────────────────────────── */
  async function openDictionaryPanel() {
    const dictionarySelection = resolveDictionarySelection();
    if (!dictionarySelection) {
      if (state.selection?.rect) {
        openPanel("Diccionari", state.selection.rect);
        setStatus("Posa el cursor sobre una paraula per consultar el diccionari.", "warn");
      }
      return;
    }

    state.selection = dictionarySelection;

    openPanel(`Diccionari · ${dictionarySelection.text.trim()}`, dictionarySelection.rect);
    setStatus("Comprovant el diccionari…", "loading");

    const response = await H.sendMessage({
      type: "inspecciona:dictionary",
      word: dictionarySelection.text.trim()
    });

    if (!response.ok) {
      setStatus(response.error || "No s'ha pogut consultar el diccionari.", "error");
      return;
    }

    const entry = response.data || {};
    if (!entry.wordFound) {
      setStatus("No s'ha trobat cap definició en català per a aquesta paraula.", "info");
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "insp-dictionary";

    const title = document.createElement("h3");
    title.className = "insp-dictionary-title";
    title.textContent = entry.word || dictionarySelection.text.trim();

    const meta = document.createElement("p");
    meta.className = "insp-dictionary-meta";
    meta.textContent = `Font: ${entry.repoName || "Viccionari en català"}`;

    const summary = document.createElement("p");
    summary.className = "insp-dictionary-summary";
    summary.textContent = entry.summary;

    const repoLink = document.createElement("a");
    repoLink.href = entry.repoUrl || `https://ca.wiktionary.org/wiki/${encodeURIComponent(entry.word || dictionarySelection.text.trim())}`;
    repoLink.target = "_blank";
    repoLink.rel = "noopener noreferrer";
    repoLink.className = "insp-link";
    repoLink.textContent = "Obrir l'entrada al Viccionari";

    wrap.append(title, meta, summary, repoLink);
    state.panelResults.replaceChildren(wrap);
    setStatus("Definicions trobades.", "ok");
  }

  function openSettingsPage() {
    const popupUrl = chrome.runtime.getURL("src/popup/popup.html");
    window.open(popupUrl, "_blank", "noopener,noreferrer");
    hideToolbar();
    closePanel();
  }

  /* ── Helpers locals ─────────────────────────────────────────────────── */
  function isInsideUi(target) {
    return Boolean(state.root && target && state.root.contains(target));
  }

  function readEditableSelection(eventTarget) {
    const editable = findEditable(eventTarget) || findEditable(document.activeElement);
    if (!editable) return readDocumentSelection();

    // <input> / <textarea>
    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      const start = editable.selectionStart ?? 0;
      const end = editable.selectionEnd ?? 0;
      if (end <= start) return null;

      const text = editable.value.slice(start, end);
      if (!text.trim()) return null;

      return {
        kind: "text-control",
        target: editable,
        text,
        start,
        end,
        rect: editable.getBoundingClientRect(),
        isSingleWord: isSingleWord(text)
      };
    }

    // contenteditable
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    if (findEditable(selection.anchorNode) !== editable || findEditable(selection.focusNode) !== editable) return null;

    const range = selection.getRangeAt(0);
    const { text, segments } = collectSelectionSegments(editable, range);
    if (!text.trim() || segments.length === 0) return null;

    let rect = range.getBoundingClientRect();
    if ((!rect || rect.width === 0) && range.getClientRects().length > 0) {
      rect = range.getClientRects()[0];
    }
    if (!rect) return null;

    return {
      kind: "contenteditable",
      target: editable,
      text,
      segments,
      rect,
      isSingleWord: isSingleWord(text)
    };
  }

  function readDocumentSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const text = String(selection.toString() || "").trim();
    if (!text) return null;

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if ((!rect || rect.width === 0) && range.getClientRects().length > 0) {
      rect = range.getClientRects()[0];
    }
    if (!rect) return null;

    return {
      kind: "document-selection",
      target: null,
      text,
      rect,
      isSingleWord: isSingleWord(text)
    };
  }

  function findEditable(node) {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return null;

    if (element instanceof HTMLTextAreaElement) return element;
    if (element instanceof HTMLInputElement) {
      const type = (element.type || "text").toLowerCase();
      return ["text", "search", "email", "url"].includes(type) ? element : null;
    }

    const editable = element.closest?.("[contenteditable]");
    if (editable && String(editable.getAttribute("contenteditable")).toLowerCase() !== "false") {
      return editable;
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element;

    return null;
  }

  function isSingleWord(text) {
    return /^\p{L}[\p{L}'’\-]*$/u.test(String(text || "").trim());
  }

  function resolveSynonymSelection() {
    if (state.selection?.text && isSingleWord(state.selection.text)) {
      return state.selection;
    }

    const editable = findEditable(document.activeElement) || findEditable(state.selection?.target);
    if (!editable) return null;

    if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
      return readWordAtCaretInTextControl(editable);
    }

    return readWordAtCaretInContentEditable(editable);
  }

  function resolveDictionarySelection() {
    const text = String(state.selection?.text || "").trim();
    if (text) {
      return state.selection;
    }

    return resolveSynonymSelection();
  }

  function readWordAtCaretInTextControl(editable) {
    const value = editable.value || "";
    if (!value.trim()) return null;

    const caret = editable.selectionStart ?? 0;
    const { start, end } = expandWordBounds(value, caret);
    if (end <= start) return null;

    const text = value.slice(start, end).trim();
    if (!isSingleWord(text)) return null;

    return {
      kind: "text-control",
      target: editable,
      text,
      start,
      end,
      rect: editable.getBoundingClientRect(),
      segments: [],
      isSingleWord: true
    };
  }

  function readWordAtCaretInContentEditable(editable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    if (findEditable(selection.anchorNode) !== editable) return null;

    const anchorNode = selection.anchorNode;
    if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return null;

    const source = anchorNode.nodeValue || "";
    const caret = selection.anchorOffset ?? 0;
    const { start, end } = expandWordBounds(source, caret);
    if (end <= start) return null;

    const range = document.createRange();
    range.setStart(anchorNode, start);
    range.setEnd(anchorNode, end);

    const collected = collectSelectionSegments(editable, range);
    const text = (collected.text || "").trim();
    if (!text || !isSingleWord(text) || collected.segments.length === 0) return null;

    let rect = range.getBoundingClientRect();
    if ((!rect || rect.width === 0) && range.getClientRects().length > 0) {
      rect = range.getClientRects()[0];
    }
    if (!rect) return null;

    return {
      kind: "contenteditable",
      target: editable,
      text,
      segments: collected.segments,
      rect,
      isSingleWord: true
    };
  }

  function expandWordBounds(text, caret) {
    const value = String(text || "");
    if (!value) return { start: 0, end: 0 };

    let index = Math.max(0, Math.min(caret, value.length));
    if (index === value.length) index = value.length - 1;
    if (index < 0) return { start: 0, end: 0 };

    if (!isWordChar(value[index])) {
      if (index > 0 && isWordChar(value[index - 1])) {
        index -= 1;
      } else {
        return { start: 0, end: 0 };
      }
    }

    let start = index;
    let end = index + 1;

    while (start > 0 && isWordChar(value[start - 1])) start -= 1;
    while (end < value.length && isWordChar(value[end])) end += 1;

    return { start, end };
  }

  function isWordChar(char) {
    return /[\p{L}'’\-]/u.test(char || "");
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
