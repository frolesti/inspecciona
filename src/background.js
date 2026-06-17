const STORAGE_DEFAULTS = {
  variant: "general",
  autoOpenHelper: true
};

const CORRECTOR_ENDPOINT = "https://api.softcatala.org/corrector/v2/check";
const SINONIMS_SEARCH_BASE = "https://api.softcatala.org/sinonims/v1/api/search/";
const SINONIMS_AUTOCOMPLETE_BASE = "https://api.softcatala.org/sinonims/v1/api/autocomplete/";

const VARIANT_TO_LT = {
  general: "ca-ES",
  valencia: "ca-ES-valencia",
  balear: "ca-ES-balear"
};

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
  });
});

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
  const preferred = VARIANT_TO_LT[variant] || VARIANT_TO_LT.general;

  const form = new URLSearchParams();
  form.set("text", text);
  form.set("language", "ca-ES");
  form.set("preferredVariants", preferred);

  const response = await fetch(CORRECTOR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  if (!response.ok) {
    throw new Error(`Error del corrector (${response.status}).`);
  }

  return response.json();
}

async function handleSynonymsMessage(message) {
  const word = normalizeWord(message?.word);
  if (!word) {
    throw new Error("Indica una paraula per cercar sinònims.");
  }

  const response = await fetch(SINONIMS_SEARCH_BASE + encodeURIComponent(word), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Error del diccionari de sinònims (${response.status}).`);
  }

  return response.json();
}

async function handleAutocompleteMessage(message) {
  const prefix = normalizeWord(message?.prefix);
  if (!prefix) {
    return { startWith: "", words: [] };
  }

  const response = await fetch(SINONIMS_AUTOCOMPLETE_BASE + encodeURIComponent(prefix), {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`Error d'autocomplete de sinònims (${response.status}).`);
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