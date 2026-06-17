# Inspecciona

Extensió de Google Chrome centrada en català, amb integració dels serveis de Softcatalà.

## Primera versió inclosa

- Correcció ortogràfica i gramatical sobre text lliure.
- Cerca de sinònims d'una paraula.
- Autocomplete de paraules del diccionari de sinònims (funcionalitat addicional de Softcatalà).

## Recerca tècnica d'API (Softcatalà)

S'han comprovat peticions reals fora de la interfície web i funcionen:

- Corrector:
  - Endpoint: `POST https://api.softcatala.org/corrector/v2/check`
  - Cos: `application/x-www-form-urlencoded`
  - Paràmetres mínims: `text`, `language=ca-ES`
  - Paràmetre útil: `preferredVariants=ca-ES|ca-ES-valencia|ca-ES-balear`

- Sinònims:
  - Endpoint: `GET https://api.softcatala.org/sinonims/v1/api/search/{paraula}`
  - Retorna `results` amb entrades i llistes de sinònims.

- Suggeriments de paraules:
  - Endpoint: `GET https://api.softcatala.org/sinonims/v1/api/autocomplete/{prefix}`

Notes:
- La web de sinònims també té una ruta interna WordPress (`admin-ajax.php` amb `action=find_sinonim`) que necessita `_wpnonce`.
- Per extensió, és millor usar els endpoints d'`api.softcatala.org` perquè no depenen de nonce ni de la UI web.

## Estructura

- `manifest.json`: definició de l'extensió MV3
- `src/background.js`: crides a API Softcatalà
- `src/content/content.js`: assistent injectat als camps de text
- `src/content/content.css`: estils de l'assistent
- `src/options/*`: pàgina d'opcions
- `src/popup/*`: popup simple de l'extensió

## Instal·lació local

1. Obre Chrome i ves a `chrome://extensions`.
2. Activa `Mode de desenvolupador`.
3. `Carrega descomprimida` i selecciona aquesta carpeta.

## Ús

1. Fes focus en un `textarea`, `input` de text o zona `contenteditable`.
2. Prem el botó `Inspecciona` que apareix sobre el camp.
3. Revisa i aplica correccions.
4. Cerca sinònims o suggereix paraules per prefix.

## Icona

S'ha deixat una icona provisional a `assets/icon.svg`.
Si vols usar exactament el teu SVG definitiu, només cal substituir aquest fitxer i, si cal, afegir versions PNG per a icones de manifest.