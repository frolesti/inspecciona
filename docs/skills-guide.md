# Com funcionen les Skills i les instruccions de Copilot

## Tres nivells d'instruccions

### 1. `.github/copilot-instructions.md` (àmbit repositori)

El fitxer més important per a un projecte. Copilot el llegeix automàticament
quan treballes en aquest repositori i l'aplica a totes les converses.

**Usa'l per a:**
- Convencions de codi del projecte (ex: "zero fitxers .css, usa ST object")
- Endpoints d'API que cal conèixer
- Estructura de carpetes i propòsit de cada fitxer
- Comandes de build i release

```
.github/copilot-instructions.md   ← ja existeix en aquest projecte
```

---

### 2. Fitxers `.instructions.md` (àmbit carpeta)

Instruccions locals per a una carpeta específica.  
Es declaren amb frontmatter YAML que especifica a quins fitxers s'apliquen:

```markdown
---
applyTo: "src/content/**"
---
# Regles per al content script
- Usa sempre `data-insp` com a selector, mai classes CSS
- Tots els estils van a l'objecte ST
```

Pots tenir un fitxer per carpeta. Copilot els llegeix quan edites
fitxers que coincideixen amb el patró `applyTo`.

---

### 3. Fitxers `.prompt.md` (plantilles de prompt reutilitzables)

Prompts que pots invocar des del xat de Copilot amb `/nom-del-prompt`.

Exemple `scripts/add-api-endpoint.prompt.md`:
```markdown
---
description: Afegeix un nou endpoint de Softcatalà a background.js
---
Afegeix suport per al nou endpoint de Softcatalà:
- URL: ${url}
- Mètode: ${method}
- Afegeix el handler a background.js seguint el patró existent
- Actualitza copilot-instructions.md amb la nova API
```

---

## Skills predefinides de VS Code Copilot

Les *skills* predefinides (com `project-setup-info-local`) estan integrades a
l'agent de Copilot. S'activen automàticament quan el context coincideix:

| Skill                   | Quan s'activa                                   |
|-------------------------|-------------------------------------------------|
| `project-setup-info-local` | Quan demanes crear un nou projecte des de zero |
| `agent-customization`   | Quan vols crear/editar instruccions o prompts   |
| `get-search-view-results` | Quan fas cerques al panell de VS Code          |

No cal invocar-les manualment; Copilot les carrega quan les necessita.

---

## Flux recomanat per a aquest projecte

1. **Canvi de codi**: Copilot llegeix `.github/copilot-instructions.md`
   automàticament → coneix les convencions sense haver de repetir-les.

2. **Nova funcionalitat**: Descriu el que vols en català.
   Copilot aplicarà les convencions del projecte (ST object, data-insp, etc.).

3. **Publicar**: `.\scripts\release.ps1` — no cal recordar cap comanda git.

4. **Provar localment**: `.\scripts\pack.ps1` → carrega el zip a Chrome.
