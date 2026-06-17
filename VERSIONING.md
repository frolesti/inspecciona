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

Genera `dist/inspecciona-X.Y.Z.zip`.  
A Chrome, en lloc de "Carrega descomprimida" pots arrossegar el `.zip` directament.

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
| 0.1.0  | 2026-06-17 | MVP: corrector, sinònims, autocomplete               |
| 0.2.0  | 2026-06-17 | Refactor: zero CSS extern, Bootstrap als HTML, scripts de build |
