# Inspecciona

Extensió de Google Chrome centrada en català, integrada amb serveis locals executats amb Docker.

## Primera versió inclosa

- Correcció ortogràfica i gramatical sobre text lliure.
- Cerca de sinònims d'una paraula.
- Autocomplete de paraules del diccionari de sinònims (funcionalitat addicional de Softcatalà).

## Backend

L'extensió funciona exclusivament contra serveis locals:

- Corrector local: `http://localhost:8081/v2/check`
- Sinònims local: `http://localhost:8000/sinonims-api/`

## Estructura

- `manifest.json`: definició de l'extensió MV3
- `src/background.js`: crides als serveis locals del backend
- `src/content/helpers.js`: helpers compartits del content script
- `src/content/content.js`: lògica UI injectada als camps de text
- `src/content/content.css`: estils de l'assistent (curt i traçable)
- `src/options/*`: pàgina d'opcions
- `src/popup/*`: popup simple de l'extensió
- `scripts/pack.ps1`: genera zip de distribució
- `scripts/release.ps1`: bump de versió + commit + tag + push

## Instal·lació local

1. Obre Chrome i ves a `chrome://extensions`.
2. Activa `Mode de desenvolupador`.
3. `Carrega descomprimida` i selecciona aquesta carpeta.

## Build de l'extensió (zip) per proves a la botiga

1. Genera el paquet:
  - `./scripts/pack.ps1`
2. Els zips quedaran a `dist/`:
  - `inspecciona-X.Y.Z-chrome.zip`
  - `inspecciona-X.Y.Z-edge.zip`
  - `inspecciona-X.Y.Z-brave.zip`
  - `inspecciona-X.Y.Z-opera.zip`
  - `inspecciona-X.Y.Z-ecosia.zip`
  - `inspecciona-X.Y.Z-firefox.zip`
  - `inspecciona-X.Y.Z-safari.zip`
  - `inspecciona-X.Y.Z.zip` (àlies de compatibilitat per a Chrome)
3. Per construir només un navegador concret:
  - `./scripts/pack.ps1 -Browser firefox`
4. A Chrome Web Store Developer Dashboard:
  - entra a l'extensió
  - ves a una versió de prova (draft/test)
  - puja el fitxer zip de `dist/`

Notes importants per al zip:
- El `manifest.json` ha d'estar a l'arrel del zip.
- No incloure carpetes temporals ni fitxers de desenvolupament.
- El script `pack.ps1` ja empaqueta només el necessari.

## Publicar una nova versió

- Patch: `./scripts/release.ps1`
- Minor: `./scripts/release.ps1 minor`
- Major: `./scripts/release.ps1 major`

Aquest script actualitza `manifest.json`, crea commit, tag i fa push.

## Ús

1. Fes focus en un `textarea`, `input` de text o zona `contenteditable`.
2. Prem el botó `Inspecciona` que apareix sobre el camp.
3. Revisa i aplica correccions.
4. Cerca sinònims o suggereix paraules per prefix.

## Backend local

Si vols provar l'extensió amb serveis propis, tens un `docker compose` local a `compose.local.yml`.

Flux ràpid:

1. Executa `./scripts/setup-local-backend.ps1` per clonar els repos dels serveis a `backend/`.
2. Executa `docker compose -f compose.local.yml up --build`.
3. Carrega l'extensió i comprova que Docker està actiu.
4. Espera que el backend estigui llest amb `./scripts/check-local-backend.ps1`.

Ports per defecte:

- Corrector: `http://localhost:8081/v2/check`
- Sinònims: `http://localhost:8000/sinonims-api/`

Els fitxers de configuració del servidor de sinònims viuen a `local-backend/configs/`.

## Icona

S'ha deixat una icona provisional a `assets/icon.svg`.
Si vols usar exactament el teu SVG definitiu, només cal substituir aquest fitxer i, si cal, afegir versions PNG per a icones de manifest.