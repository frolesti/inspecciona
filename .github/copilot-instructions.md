# Instruccions per a GitHub Copilot — Inspecciona

Extensió de Chrome MV3 per a l'assistent de llengua catalana.
Serveis: corrector ortogràfic/gramatical, sinònims i autocomplete de Softcatalà.

---

## Estructura del projecte

```
manifest.json              # Manifest MV3 (conté la versió única de veritat)
assets/icon.svg            # Icona provisional
src/
  background.js            # Service worker (ES module). Gestiona les crides HTTP.
  content/helpers.js       # Helpers del content script.
  content/content.js       # Content script. Crea i gestiona el UI injectat.
  content/content.css      # Estils del panell injectat.
  popup/popup.html|js      # Popup únic: opcions + identitat + mecenatge.
scripts/
  pack.ps1                 # Genera zips multi-browser a dist/
  release.ps1              # Bump de versió + commit + tag + push
```

---

## Convencions de codi

### Estils: traçables i mantenibles

- **content/content.css**: estils del panell injectat, curts i agrupats per seccions.
  Evitar fitxers CSS gegants i regles sense ús.
- **content/content.js**: només lògica i wiring d'events.
- **content/helpers.js**: utilitats reutilitzables (escapeHtml, sendMessage, text helpers...).

- **popup.html / options.html**: Bootstrap 5 CDN via `<link>`.
  Tota l'aparença ve de classes Bootstrap directament als elements HTML.
  **Mai crear fitxers .css separats per a les pàgines HTML de l'extensió.**

### Selectors dins del panell injectat

Usar atributs `data-insp="nom"`, NO classes ni IDs:

```js
// Correcte
panel.querySelector('[data-insp="text"]')

// Incorrecte
panel.querySelector('.insp-text')
```

### Missatgeria background ↔ content

```js
// Des del content script:
chrome.runtime.sendMessage({ type: "inspecciona:check",       text, variant })
chrome.runtime.sendMessage({ type: "inspecciona:synonyms",    word })
chrome.runtime.sendMessage({ type: "inspecciona:autocomplete", prefix })

// Resposta sempre: { ok: boolean, data?: any, error?: string }
```

---

## APIs de Softcatalà (validades, sense autenticació)

| Servei       | Mètode | URL                                                        |
|--------------|--------|------------------------------------------------------------|
| Corrector    | POST   | `https://api.softcatala.org/corrector/v2/check`            |
| Sinònims     | GET    | `https://api.softcatala.org/sinonims/v1/api/search/{word}` |
| Autocomplete | GET    | `https://api.softcatala.org/sinonims/v1/api/autocomplete/{prefix}` |

Corrector – body `application/x-www-form-urlencoded`:
- `text` (obligatori)
- `language=ca-ES`
- `preferredVariants`: `ca-ES` | `ca-ES-valencia` | `ca-ES-balear`

---

## Scripts de build

```powershell
.\scripts\pack.ps1                    # zips per a chrome/edge/brave/opera/ecosia/firefox/safari
.\scripts\release.ps1 [major|minor|patch]  # publica nova versió
```

Veure `VERSIONING.md` per al flux complet.
