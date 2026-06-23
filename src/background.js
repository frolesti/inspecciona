const STORAGE_DEFAULTS = {
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

const CORRECTOR_ENDPOINT = "https://api.softcatala.org/corrector/v2/check";
const SINONIMS_SEARCH_BASE = "https://api.softcatala.org/sinonims/v1/api/search/";
const SINONIMS_AUTOCOMPLETE_BASE = "https://api.softcatala.org/sinonims/v1/api/autocomplete/";

const VARIANT_TO_LT = {
  general:  "ca-ES",
  valencia: "ca-ES-valencia",
  balear:   "ca-ES-balear"
};

/* Mapatge de preferències d'usuari → noms de regla de LanguageTool/Softcatalà.
   Format: { rules: ["ID1", "ID2"], disabled: ["ID3"] } per a cada opció triada. */
const RULE_MAP = {
  diacritics: {
    traditional: { enabled: ["DIACRITICS_TRADITIONAL_DICT"], disabled: ["DIACRITICS_IEC_DICT"] },
    iec:         { enabled: ["DIACRITICS_IEC_DICT"],         disabled: ["DIACRITICS_TRADITIONAL_DICT"] }
  },
  pronomSe: {
    simple: { enabled: [], disabled: ["SE_DAVANT_SC"] },
    double: { enabled: ["SE_DAVANT_SC"], disabled: [] }
  },
  cometesTypo:  { enabled: ["COMETES_BAIXES"],  disabled: [] },
  puntsSuspe:   { enabled: ["PUNTS_SUSPENSIUS_CARACTER"], disabled: [] },
  apostrof: {
    typo:    { enabled: ["APOSTROF_TIPOGRAFIC"], disabled: ["APOSTROF_RECTE"] },
    recte:   { enabled: ["APOSTROF_RECTE"], disabled: ["APOSTROF_TIPOGRAFIC"] }
  },
  guio: {
    llarg:  { enabled: ["GUIONET_LLARG"], disabled: ["GUIONET_MITJA"] },
    mitja:  { enabled: ["GUIONET_MITJA"], disabled: ["GUIONET_LLARG"] }
  },
  guioPer: {
    dialegs:      { enabled: ["GUIONET_DIALEGS"], disabled: [] },
    enumeracions: { enabled: ["GUIONET_ENUMERACIONS"], disabled: [] }
  },
  interrogant: {
    mai:    { enabled: [], disabled: ["INTERROGANT_INICIAL"] },
    sempre: { enabled: ["INTERROGANT_INICIAL"], disabled: [] }
  },
  exclamacio: {
    mai:    { enabled: [], disabled: ["EXCLAMACIO_INICIAL"] },
    sempre: { enabled: ["EXCLAMACIO_INICIAL"], disabled: [] }
  },
  percent: {
    sense:  { enabled: ["TANT_PER_CENT"], disabled: ["TANT_PER_CENT_AMB_ESPAI"] },
    amb:    { enabled: ["TANT_PER_CENT_AMB_ESPAI"], disabled: ["TANT_PER_CENT"] }
  },
  hora: {
    punt:    { enabled: ["HORES_PUNT"], disabled: ["HORES_DOS_PUNTS"] },
    dospunts:{ enabled: ["HORES_DOS_PUNTS"], disabled: ["HORES_PUNT"] }
  }
};

function buildRuleFlags(prefs = {}) {
  const enabled = new Set();
  const disabled = new Set();

  function apply(group, key) {
    const def = RULE_MAP[group]?.[key];
    if (!def) return;
    def.enabled?.forEach((id) => enabled.add(id));
    def.disabled?.forEach((id) => disabled.add(id));
  }

  apply("diacritics", prefs.diacritics);
  apply("pronomSe",   prefs.pronomSe);
  apply("apostrof",   prefs.apostrof);
  apply("guio",       prefs.guio);
  apply("guioPer",    prefs.guioPer);
  apply("interrogant",prefs.interrogant);
  apply("exclamacio", prefs.exclamacio);
  apply("percent",    prefs.percent);
  apply("hora",       prefs.hora);

  if (prefs.cometesTypo) RULE_MAP.cometesTypo.enabled.forEach((id) => enabled.add(id));
  if (prefs.puntsSuspe)  RULE_MAP.puntsSuspe.enabled.forEach((id) => enabled.add(id));

  return {
    enabledRules:  Array.from(enabled).join(","),
    disabledRules: Array.from(disabled).join(",")
  };
}

const REQUEST_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("El servei ha trigat massa a respondre.");
    }
    throw new Error("No s'ha pogut connectar amb el servei.");
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(Object.keys(STORAGE_DEFAULTS), (items) => {
    const next = {};
    for (const [key, value] of Object.entries(STORAGE_DEFAULTS)) {
      if (typeof items[key] === "undefined") {
        next[key] = value;
      }
    }
    if (Object.keys(next).length > 0) {
      chrome.storage.sync.set(next);
    }
    refreshActionIcon(items.autoOpenHelper !== false);
  });
});

chrome.runtime.onStartup?.addListener?.(() => {
  chrome.storage.sync.get({ autoOpenHelper: true }, (items) => {
    refreshActionIcon(items.autoOpenHelper !== false);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("autoOpenHelper" in changes) {
    refreshActionIcon(changes.autoOpenHelper.newValue !== false);
  }
});

/* ── Icona del toolbar: color quan està actiu, gris real quan està desactivat ── */
const ICON_SIZES = [16, 32, 48, 128];
let cachedColorIcons = null;
let cachedGrayIcons  = null;

async function refreshActionIcon(enabled) {
  try {
    const imageData = enabled ? await getColorIcons() : await getGrayIcons();
    await chrome.action.setIcon({ imageData });
    chrome.action.setTitle({
      title: enabled ? "Inspecciona — actiu" : "Inspecciona — desactivat"
    });
  } catch (error) {
    console.warn("[Inspecciona] No s'ha pogut canviar la icona:", error?.message || error);
  }
}

async function getColorIcons() {
  if (cachedColorIcons) return cachedColorIcons;
  const result = {};
  for (const size of ICON_SIZES) {
    result[size] = await loadIcon(`assets/icon-${size}.png`, size, false);
  }
  cachedColorIcons = result;
  return result;
}

async function getGrayIcons() {
  if (cachedGrayIcons) return cachedGrayIcons;
  const result = {};
  for (const size of ICON_SIZES) {
    result[size] = await loadIcon(`assets/icon-${size}.png`, size, true);
  }
  cachedGrayIcons = result;
  return result;
}

async function loadIcon(path, size, grayscale) {
  const url = chrome.runtime.getURL(path);
  const response = await fetch(url);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size);
  if (!grayscale) return data;

  const pixels = data.data;
  for (let i = 0; i < pixels.length; i += 4) {
    // Lluminositat percebuda (Rec. 709) + atenua una mica per donar
    // sensació "off"
    const luma = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    const gray = Math.round(luma * 0.7 + 40);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
  }
  return data;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type;
  if (!type) {
    return;
  }

  if (type === "inspecciona:check") {
    handleCheckMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));
    return true;
  }

  if (type === "inspecciona:synonyms") {
    handleSynonymsMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));
    return true;
  }

  if (type === "inspecciona:autocomplete") {
    handleAutocompleteMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: normalizeError(error) }));
    return true;
  }
});

async function handleCheckMessage(message) {
  const text = String(message?.text ?? "").trim();
  if (!text) {
    throw new Error("No hi ha text per corregir.");
  }

  const variant = message?.variant || "general";
  const language = VARIANT_TO_LT[variant] || VARIANT_TO_LT.general;

  const form = new URLSearchParams();
  form.set("text", text);
  form.set("language", language);

  const flags = buildRuleFlags(message?.prefs || {});
  if (flags.enabledRules)  form.set("enabledRules",  flags.enabledRules);
  if (flags.disabledRules) form.set("disabledRules", flags.disabledRules);

  const response = await fetchWithTimeout(CORRECTOR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  if (!response.ok) {
    throw new Error(`El corrector ha respost amb error (${response.status}).`);
  }

  return response.json();
}

async function handleSynonymsMessage(message) {
  const word = normalizeWord(message?.word);
  if (!word) {
    throw new Error("Indica una paraula per cercar sinònims.");
  }

  const response = await fetchWithTimeout(SINONIMS_SEARCH_BASE + encodeURIComponent(word), {
    method: "GET"
  });

  if (response.status === 404) {
    return { results: [] };
  }

  if (!response.ok) {
    throw new Error(`Diccionari de sinònims no disponible (${response.status}).`);
  }

  return response.json();
}

async function handleAutocompleteMessage(message) {
  const prefix = normalizeWord(message?.prefix);
  if (!prefix) {
    return { startWith: "", words: [] };
  }

  const response = await fetchWithTimeout(SINONIMS_AUTOCOMPLETE_BASE + encodeURIComponent(prefix), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Autocomplete no disponible (${response.status}).`);
  }

  return response.json();
}

function normalizeWord(input) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeError(error) {
  if (!error) {
    return "Error desconegut.";
  }
  if (typeof error === "string") {
    return error;
  }
  return error.message || "Error desconegut.";
}