const DEFAULTS = {
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

const RADIO_GROUPS = [
  "variant", "diacritics", "pronomSe", "apostrof",
  "guio", "guioPer", "interrogant", "exclamacio",
  "percent", "hora"
];

const CHECKBOX_FIELDS = ["cometesTypo", "puntsSuspe"];

const toggleInput    = document.getElementById("autoOpenHelper");
const toggleTitleEl  = document.getElementById("toggleTitle");
const toggleStatusEl = document.getElementById("toggleStatus");
const limitNotice = document.getElementById("limitNotice");
const limitNoticeText = document.getElementById("limitNoticeText");
const extensionVersionEl = document.getElementById("extensionVersion");

restore();
wirePillsVisual();
wireAutoSave();
renderVersion();
toggleInput.addEventListener("change", onToggleChange);

function renderVersion() {
  if (!extensionVersionEl) return;
  const manifest = chrome.runtime.getManifest();
  extensionVersionEl.textContent = `v${manifest.version}`;
}

function restore() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    for (const group of RADIO_GROUPS) {
      const value = items[group] ?? DEFAULTS[group];
      const input = document.querySelector(`input[name="${group}"][value="${escapeAttr(value)}"]`);
      if (input) input.checked = true;
      paintPills(group);
    }
    for (const field of CHECKBOX_FIELDS) {
      const el = document.getElementById(field);
      if (el) el.checked = Boolean(items[field]);
    }
    toggleInput.checked = items.autoOpenHelper !== false;
    applyEnabledState(toggleInput.checked);
  });

  chrome.storage.local.get({ inspeccionaLimitNotice: null }, (items) => {
    const info = items?.inspeccionaLimitNotice;
    if (!info?.active) {
      if (limitNotice) limitNotice.hidden = true;
      return;
    }

    const when = info.at ? new Date(info.at).toLocaleString("ca-ES") : "ara mateix";
    const status = info.status ? ` (${info.status})` : "";
    const isOverload = [429, 503, 504].includes(Number(info.status));
    if (limitNoticeText) {
      limitNoticeText.textContent = isOverload
        ? `S'ha detectat saturacio del backend per pic de trafic${status}. Darrera incidencia: ${when}.`
        : `S'ha detectat un limit d'us del backend${status}. Darrera incidencia: ${when}.`;
    }
    if (limitNotice) {
      limitNotice.hidden = false;
    }
  });
}

async function saveOptions() {
  const payload = { autoOpenHelper: toggleInput.checked };
  for (const group of RADIO_GROUPS) {
    const checked = document.querySelector(`input[name="${group}"]:checked`);
    payload[group] = checked ? checked.value : DEFAULTS[group];
  }
  for (const field of CHECKBOX_FIELDS) {
    const el = document.getElementById(field);
    payload[field] = el ? el.checked : DEFAULTS[field];
  }

  chrome.storage.sync.set(payload);
}

function onToggleChange() {
  const enabled = toggleInput.checked;
  applyEnabledState(enabled);
  saveOptions();
}

function applyEnabledState(enabled) {
  document.body.classList.toggle("is-disabled", !enabled);
  toggleTitleEl.textContent  = enabled ? "Inspector actiu" : "Inspector inactiu";
  toggleStatusEl.textContent = enabled
    ? "Vigilant els camps editables."
    : "No apareixeran suggeriments.";
}

function wireAutoSave() {
  for (const group of RADIO_GROUPS) {
    document.querySelectorAll(`input[name="${group}"]`).forEach((input) => {
      input.addEventListener("change", () => saveOptions());
    });
  }
  for (const field of CHECKBOX_FIELDS) {
    const input = document.getElementById(field);
    input?.addEventListener("change", () => { saveOptions(); });
  }
}

/* Pastilles per a radios visualment agrupats. */
function wirePillsVisual() {
  for (const group of RADIO_GROUPS) {
    document.querySelectorAll(`input[name="${group}"]`).forEach((input) => {
      input.addEventListener("change", () => paintPills(group));
    });
  }
}

function paintPills(group) {
  document.querySelectorAll(`input[name="${group}"]`).forEach((input) => {
    const pill = input.closest(".insp-pill");
    if (!pill) return;
    pill.classList.toggle("is-active", input.checked);
  });
}

function escapeAttr(value) {
  return String(value ?? "").replace(/"/g, '\\"');
}
