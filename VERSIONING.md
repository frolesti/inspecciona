# Guia de versionat — Inspecciona

## Nomenclatura (SemVer)

`MAJOR.MINOR.PATCH`

| Part    | Quan incrementar                              |
|---------|-----------------------------------------------|
| `MAJOR` | Canvis incompatibles o redisseny complet      |
| `MINOR` | Nova funcionalitat, compatible cap enrere     |
| `PATCH` | Correccions de bugs sense funcionalitats noves|

La versió viu **exclusivament** a `manifest.json → "version"`.  
**Mai** editar-la a mà si uses el script de release.

---

## Flux de treball

### 1. Desenvolupament i prova local

Carrega l'extensió sense generar cap zip:

1. `chrome://extensions` → activa **Mode de desenvolupador**
2. **Carrega descomprimida** → selecciona la carpeta arrel del repositori
3. Després de canvis: botó **Actualitza** a la targeta de l'extensió (o Ctrl+R al popup)

### 2. Generar un zip per compartir / provar en un altre perfil

```powershell
.\scripts\pack.ps1
```

Genera paquets multi-browser a `dist/`:
- `inspecciona-X.Y.Z-chrome.zip`
- `inspecciona-X.Y.Z-edge.zip`
- `inspecciona-X.Y.Z-brave.zip`
- `inspecciona-X.Y.Z-opera.zip`
- `inspecciona-X.Y.Z-ecosia.zip`
- `inspecciona-X.Y.Z-firefox.zip`
- `inspecciona-X.Y.Z-safari.zip`

També manté `inspecciona-X.Y.Z.zip` com a àlies de compatibilitat per Chrome.

Per generar només un navegador:

```powershell
.\scripts\pack.ps1 -Browser firefox
```

### 3. Publicar una nova versió

```powershell
# Puja un patch  (0.1.0 → 0.1.1)
.\scripts\release.ps1

# Puja un minor  (0.1.0 → 0.2.0)
.\scripts\release.ps1 minor

# Puja un major  (0.1.0 → 1.0.0)
.\scripts\release.ps1 major
```

L'script fa tot sol:
- Actualitza `manifest.json`
- `git commit -m "chore: bump version to X.Y.Z"`
- `git tag vX.Y.Z`
- `git push` + `git push --tags`

---

## Historial

| Versió | Data       | Descripció                                           |
|--------|------------|------------------------------------------------------|
| 2.1.0  | 2026-10-13 | Correccions només per clic i alternatives; panells unificats; sinònims per accepcions; consulta de flexions al diccionari |
| 2.0.0  | 2026-10-07 | Detecció mentre s'escriu en lloc de seleccionar text per corregir; diccionari català a la VM |
| 0.1.0  | 2026-06-17 | MVP: corrector, sinònims, autocomplete               |
| 0.2.0  | 2026-06-17 | Refactor: zero CSS extern, Bootstrap als HTML, scripts de build |

## Novetats de la versió 2.1.0

- Les correccions s'obren només amb un clic explícit, no en passar el cursor ni quan arriba la resposta del corrector.
- Selector de propostes quan una incidència té diverses correccions possibles.
- Revisió automàtica després d'aplicar una correcció i millor interacció entre errors propers.
- Revisió inicial de camps amb text i compatibilitat amb inputs, textareas i editors `contenteditable="plaintext-only"`.
- Estil compartit entre correccions, sinònims i diccionari, sense franja lateral al popup de correcció.
- Indicador de càrrega accessible, amb respecte pel moviment reduït.
- Panells que recalculen la posició i limiten l'alçada quan arriben resultats llargs, amb desplaçament intern.
- Sinònims agrupats per lema i accepció, amb categories gramaticals llegibles, formes femenines, comentaris i locucions.
- Definicions numerades, atribució breu i enllaços al Viccionari, Softcatalà i la llicència CC BY-SA 4.0.
- Cerca alternativa de lemes per a plurals, femenins i participis regulars validats pel servei de sinònims. Les definicions directes tenen prioritat; no cobreix totes les formes irregulars.
- Enllaços externs amb navegació explícita en una pestanya nova, inclosa la fitxa d'Inspecciona a la Chrome Web Store.
- Informes d'error amb el gestor de correu predeterminat, sense imposar Gmail.

Validació: tests d'utilitats i consulta de flexions; proves de navegador de les interaccions, la substitució i el posicionament. No s'ha fet una validació completa en sessions autenticades de totes les webs.
