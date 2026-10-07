# Inspecciona

Extensió de Google Chrome centrada en català, integrada amb serveis propis executats amb Docker a la VM.

## Versió 2.0

- Detecció ortogràfica i gramatical mentre s'escriu, amb revisió després d'una pausa de 480 ms.
- Correccions directament sobre les incidències marcades, sense haver de seleccionar el text.
- Clicar el text o moure el cursor no torna a carregar la detecció.
- Cerca de sinònims d'una paraula.
- Consulta de definicions del diccionari català allotjat a la mateixa VM.
- Autocomplete de paraules del diccionari de sinònims (funcionalitat addicional de Softcatalà).

## Backend

La build distribuïda consulta els serveis propis de la VM:

- Corrector: `https://corrector.34.118.197.141.nip.io/v2/check`
- Sinònims: `https://corrector.34.118.197.141.nip.io/sinonims-api/`
- Diccionari: `https://corrector.34.118.197.141.nip.io/diccionari-api/search/`

Els scripts de backend local preparen només el corrector i els sinònims;
el diccionari de la versió 2.0 està desplegat a la VM.

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

## Diccionari català a la VM

El servei `diccionari` de `compose.vm.yml` executa el projecte original
[Softcatala/diccionari-multilingue](https://github.com/Softcatala/diccionari-multilingue)
amb Flask, Gunicorn i Whoosh. La consulta pública és
`https://corrector.34.118.197.141.nip.io/diccionari-api/search/casa?lang=ca&it=1`.
Retorna una llista d'entrades amb `word_ca`, `definition_ca` i `references`;
una paraula inexistent retorna `[]`. No consulta serveis externs, no usa MongoDB
i té el seguiment de consultes desactivat.

El codi recuperat viu a `backend/diccionari-multilingue`. Es mantenen les llicències
originals del projecte. El corpus és el dump oficial de
[Viccionari](https://dumps.wikimedia.org/cawiktionary/latest/), amb atribució als
col·laboradors i [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
S'importen exclusivament les definicions de les seccions catalanes de l'espai principal,
inclosos noms, verbs i altres categories, sense exigir traduccions ni llistes Apertium.

A producció, `/home/frolesti4/inspecciona/local-backend/diccionari` conserva el dump i
`indexdir`; el contenidor els munta en mode de només lectura a `/data`.
El volum `diccionari-python` conserva les dependències fixades.
Per reimportar un dump descarregat i verificat amb el checksum oficial, des del
directori de producció, amb el servei aturat durant la reconstrucció de l'índex:

```sh
sudo -n docker compose --env-file .env.vm -f compose.vm.yml stop diccionari
sudo -n docker compose --env-file .env.vm -f compose.vm.yml run --rm --no-deps \
  -v /home/frolesti4/inspecciona/local-backend/diccionari:/data diccionari \
  /opt/diccionari-python/bin/python /work/diccionari/sources/wikidictionary/extract-to-json.py \
  /data/cawiktionary-latest-pages-articles.xml.bz2 --index-dir /data/indexdir
sudo -n docker compose --env-file .env.vm -f compose.vm.yml up -d --no-deps diccionari
```

Abans de canviar les rutes, cal fer còpia de seguretat de `compose.vm.yml` i
`deploy/Caddyfile`, validar Compose amb `config --quiet` i Caddy amb `caddy validate`.
Després cal recrear només Caddy amb `up -d --no-deps --force-recreate caddy`, perquè
el seu fitxer de configuració és un bind mount individual. No cal reiniciar
LanguageTool ni sinònims.