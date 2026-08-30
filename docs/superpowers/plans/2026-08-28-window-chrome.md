# Chrome de la fenêtre — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** supprimer les 58 px de chrome que personne n'a dessinés (barre de
titre Windows et menu Electron par défaut) en faisant de la bande de recherche
du client la barre de titre de la fenêtre.

**Architecture :** la fenêtre serveur passe en `titleBarStyle: 'hidden'` avec
`titleBarOverlay`, donc Windows peint toujours ses trois boutons mais dans une
bande qui appartient à l'application. C'est la page distante qui fournit la
zone de glissement : le shell ne bascule en mode sans cadre que si la version
du serveur la fournit, contrôle fait **avant** de construire la fenêtre parce
que `titleBarStyle` ne se change pas après coup. Les couleurs des boutons
suivent le thème, annoncées par le client via le pont `window.bullshark` qui
existe déjà.

**Pile :** Electron 33, TypeScript, vitest (dépôt desktop) ; React 19,
Tailwind 4 (dépôt client).

**Spec :** `docs/superpowers/specs/2026-08-28-window-chrome-design.md`
(dans le dépôt `bullshark-desktop`)

## ⚠️ Ce plan traverse DEUX dépôts

Chaque tâche indique son dépôt. L'ordre n'est pas négociable, il est imposé par
la spec :

| Tâches | Dépôt | Chemin | Branche |
| --- | --- | --- | --- |
| 1 à 3 | client | `C:/Users/Neckr/Documents/bullshark` | `feat/frameless-support` |
| 4 à 7 | desktop | `C:/Users/Neckr/Documents/bullshark-desktop` | `feat/window-chrome` |

**Le client d'abord.** Un shell sans cadre qui charge un serveur sans zone de
glissement donne une fenêtre impossible à déplacer. Le client sort en `0.0.29`,
puis le shell fixe son seuil sur cette version.

Les appels du client au shell sont **tous en chaînage optionnel**
(`window.bullshark?.setTitleBarColors?.(...)`) : tant que les tâches 4 à 7 ne
sont pas livrées, ils ne font rien, et le client reste parfaitement fonctionnel
dans un navigateur comme dans l'ancienne version du shell.

## Contraintes globales

**Dépôt client (`bullshark`) :**

- Prettier : `singleQuote: true`, `trailingComma: "none"`, `printWidth: 80`,
  `semi: true`. La CI casse sur `format:check`.
- Portes à zéro erreur : `bun run format:check`, `bun run check-types`,
  `bun run lint`.
- Tout ce qui est ajouté est conditionné à `window.bullshark?.isDesktop`. Dans
  un navigateur, **rien ne doit changer**.
- La barre du haut est déjà `hidden lg:grid` : mobile et PWA ne sont pas
  concernés.

**Dépôt desktop (`bullshark-desktop`) :**

- **Il n'y a pas de porte de formatage** dans ce dépôt : aucun script `format`,
  aucun `.prettierrc`. Ne pas lancer `format:check`, ne pas reformater les
  fichiers existants.
- Portes à zéro erreur : `bun run typecheck`, `bun run lint`, `bun run test`.
- Le runner de tests est **vitest** (`vitest run`), pas `bun test`. Les tests
  vivent à côté du fichier testé, en `*.test.ts`, et importent depuis
  `'vitest'`.

**Les deux :**

- Aucune dépendance nouvelle.
- Messages de commit en français, préfixe conventional-commit, et les deux
  lignes de fin :
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YTbgCnmJFC1jPgAD4ukYEn
  ```

---

### Tâche 1 : convertir un jeton de thème en couleur peignable — CLIENT

**Fichiers :**

- Créer : `apps/client/src/helpers/token-to-hex.ts`
- Créer : `apps/client/src/helpers/__tests__/token-to-hex.test.ts`

**Interfaces :**

- Consomme : rien.
- Produit : `tokenToHex(token: string): string | null` — prend un nom de
  propriété personnalisée (`'--card'`) et rend `'#rrggbb'`, ou `null` si la
  couleur est introuvable ou illisible.

Le client a désormais un runner de tests unitaires (`bun test`, ajouté au
chantier du sélecteur rapide) et des tests dans `__tests__/`.

**Pourquoi ce module existe.** `setTitleBarOverlay` de Windows veut une couleur
qu'il sait peindre ; les jetons du client sont en `oklch`. Et on ne peut pas se
reposer sur `getComputedStyle(...).backgroundColor` : Chromium ne garantit pas
de sérialiser une couleur `oklch` en `rgb()` — selon la version il rend
`oklab(...)` ou `color(...)`. L'aller-retour par un canevas d'un pixel est
déterministe, quelle que soit la façon dont le moteur sérialise.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `apps/client/src/helpers/__tests__/token-to-hex.test.ts` :

```ts
import { describe, expect, test } from 'bun:test';
import { rgbToHex } from '../token-to-hex';

describe('rgbToHex', () => {
  test('compose un hexadécimal à partir de trois canaux', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  test('complète chaque canal sur deux chiffres', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });

  test('borne les canaux hors plage', () => {
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });

  test('arrondit les canaux fractionnaires', () => {
    expect(rgbToHex(127.6, 0.4, 200.5)).toBe('#8000c9');
  });
});
```

Seule la fonction pure est testée : `bun test` n'a ni `document` ni canevas, et
monter un DOM factice pour vérifier que le navigateur sait peindre une couleur
testerait le navigateur, pas notre code.

- [ ] **Étape 2 : vérifier que le test échoue**

Lancer : `cd apps/client && bun test src/helpers`
Attendu : ÉCHEC, `Cannot find module '../token-to-hex'`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `apps/client/src/helpers/token-to-hex.ts` :

```ts
const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;

// Windows peint la superposition de la barre de titre à partir d'une couleur
// qu'il sait lire ; nos jetons sont en oklch. getComputedStyle ne suffit pas :
// Chromium ne garantit pas de sérialiser une couleur oklch en rgb(), il peut
// rendre oklab() ou color(). Peindre un pixel puis le relire donne le sRGB
// exact, quelle que soit la sérialisation du moteur.
const tokenToHex = (token: string): string | null => {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();

    if (!value) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return null;

    context.fillStyle = '#000000';
    context.fillStyle = value;

    // fillStyle refuse silencieusement une valeur illisible et garde la
    // précédente : le noir de repli signale alors une couleur non comprise.
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

    return rgbToHex(red!, green!, blue!);
  } catch {
    // Un canevas peut être refusé par un navigateur durci ; la barre de titre
    // gardera simplement ses couleurs provisoires.
    return null;
  }
};

export { rgbToHex, tokenToHex };
```

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `cd apps/client && bun test src/helpers`
Attendu : 4 tests au vert.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/helpers/token-to-hex.ts apps/client/src/helpers/__tests__/token-to-hex.test.ts
git commit -m "feat(client): convertir un jeton de theme en couleur peignable"
```

---

### Tâche 2 : annoncer les couleurs de la barre de titre au shell — CLIENT

**Fichiers :**

- Créer : `apps/client/src/hooks/use-title-bar-colors.ts`
- Modifier : `apps/client/src/screens/server-view/index.tsx`
- Modifier : la déclaration de type de `window.bullshark` (la trouver avec
  `grep -rn "bullshark?:" apps/client/src`, elle accompagne
  `use-desktop-bridge.ts`)

**Interfaces :**

- Consomme : `tokenToHex` (tâche 1).
- Produit : `useTitleBarColors()` — un hook sans argument ni retour, à monter
  une fois dans la vue serveur.

- [ ] **Étape 1 : étendre le type du pont**

Ajouter le membre optionnel à la déclaration de `window.bullshark` :

```ts
  setTitleBarColors?: (colors: {
    color: string;
    symbolColor: string;
  }) => void;
```

**Optionnel, et ce n'est pas une commodité :** le client sortira avant le
shell. Sur un shell plus ancien, le membre n'existe pas ; le chaînage optionnel
est ce qui évite l'erreur.

- [ ] **Étape 2 : écrire le hook**

Créer `apps/client/src/hooks/use-title-bar-colors.ts` :

```ts
import { tokenToHex } from '@/helpers/token-to-hex';
import { useEffect } from 'react';

// Le shell desktop peint la superposition de la barre de titre avec une
// couleur figée à la construction de la fenêtre. Bullshark a cinq thèmes plus
// un thème sur mesure : sans cette annonce, les boutons du système jureraient
// avec quatre thèmes sur cinq.
const useTitleBarColors = () => {
  useEffect(() => {
    if (!window.bullshark?.isDesktop) return;

    const publish = () => {
      const color = tokenToHex('--card');
      const symbolColor = tokenToHex('--foreground');

      if (!color || !symbolColor) return;

      window.bullshark?.setTitleBarColors?.({ color, symbolColor });
    };

    publish();

    // Le thème vit dans les classes de <html> (`dark`, `theme-*`) et le thème
    // sur mesure dans son attribut de style : observer les deux attributs
    // couvre tous les changements de thème sans connaître leur mécanique.
    const observer = new MutationObserver(publish);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => observer.disconnect();
  }, []);
};

export { useTitleBarColors };
```

- [ ] **Étape 3 : monter le hook**

Dans `apps/client/src/screens/server-view/index.tsx`, appeler
`useTitleBarColors()` dans le corps du composant, avec les autres hooks. Ne pas
le monter plus haut : la barre de titre n'a de sens que dans la vue serveur.

- [ ] **Étape 4 : vérifier**

Lancer : `cd apps/client && bun run check-types`
Attendu : aucune erreur. Vérifier de plus, en lisant, que le hook sort
immédiatement hors desktop — un `MutationObserver` posé dans un navigateur
serait un coût pour rien.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/hooks/use-title-bar-colors.ts apps/client/src/screens/server-view apps/client/src/types
git commit -m "feat(client): annoncer les couleurs de la barre de titre au shell"
```

---

### Tâche 3 : rendre la bande du haut déplaçable — CLIENT

**Fichiers :**

- Modifier : `apps/client/src/components/top-bar/index.tsx`
- Modifier : `apps/client/src/index.css` (une règle, en bas de fichier)

**Interfaces :**

- Consomme : `window.bullshark?.isDesktop`.
- Produit : rien qu'une autre tâche importe. C'est ce qui rend la fenêtre
  déplaçable une fois le shell sans cadre.

- [ ] **Étape 1 : poser les règles CSS**

`-webkit-app-region` n'a pas d'utilitaire Tailwind. Ajouter en bas de
`apps/client/src/index.css`, après les autres règles applicatives :

```css
/* --------------------------------------------------------------------------
   Zone de glissement de la fenêtre desktop.

   Le shell Electron ouvre la fenêtre sans cadre : c'est la page qui doit dire
   par où on attrape la fenêtre. Ces deux classes ne sont posées que lorsque
   `window.bullshark?.isDesktop` est vrai, donc jamais dans un navigateur.

   Spec : docs/superpowers/specs/2026-08-28-window-chrome-design.md (dépôt
   bullshark-desktop)
   -------------------------------------------------------------------------- */
.app-drag {
  -webkit-app-region: drag;
}

.app-no-drag {
  -webkit-app-region: no-drag;
}
```

- [ ] **Étape 2 : appliquer les classes dans la barre du haut**

Dans `apps/client/src/components/top-bar/index.tsx` :

```tsx
const isDesktopShell = Boolean(window.bullshark?.isDesktop);
```

puis, sur le conteneur de la barre (ligne 29), ajouter `isDesktopShell &&
'app-drag'` au `cn(...)` — le fichier n'utilise pas encore `cn`, l'importer
depuis `@/lib/utils`.

**Puis rendre `no-drag` tout ce qui est cliquable dedans** : la colonne du
milieu (qui porte `ServerSearch`) et la colonne de droite (greffons, boutons
vocaux, bouton du panneau des membres).

```tsx
      <div className={cn('flex items-center justify-center', isDesktopShell && 'app-no-drag')}>
        {settings?.enableSearch && <ServerSearch />}
      </div>

      <div className={cn('flex min-w-0 items-center justify-end gap-2', isDesktopShell && 'app-no-drag')}>
```

**C'est le piège principal de la tâche.** Un contrôle laissé en zone de
glissement **cesse d'être cliquable**, sans erreur, sans avertissement, sans
rien dans la console : juste un bouton mort. Passer en revue chaque enfant
interactif de la barre.

- [ ] **Étape 3 : réserver la place des boutons système**

Toujours dans le même fichier, sur le conteneur de la barre, ajouter en mode
desktop un remplissage droit de la largeur des boutons, et à gauche celle des
pastilles macOS :

```tsx
        style={
          isDesktopShell
            ? {
                paddingLeft: 'env(titlebar-area-x, 0px)',
                paddingRight:
                  'calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px))'
              }
            : undefined
        }
```

Se servir des variables d'environnement `titlebar-area-*` plutôt que d'écrire
une constante : la largeur des boutons dépend de l'échelle d'affichage de
Windows, une valeur en dur serait fausse dès qu'on change d'écran. Les valeurs
de repli (`0px`, `100vw`) rendent la règle inoffensive partout où ces variables
n'existent pas.

**Correction d'une affirmation de la spec, à ne pas reproduire :** la spec dit
que la colonne gauche réservera la place des pastilles macOS grâce à
`env(titlebar-area-x)`. C'est faux — ces variables viennent de l'API Window
Controls Overlay, exposée sur **Windows et Linux seulement**. Sur macOS le
repli `0px` s'applique et rien n'est réservé. Ce n'est pas bloquant : la spec
place macOS hors périmètre explicite, faute de version distribuée. La colonne
gauche reste donc vide, et le jour où macOS sera vraiment visé il faudra une
constante ou une mesure, pas ces variables.

- [ ] **Étape 4 : vérifier**

Lancer : `cd apps/client && bun run check-types && bun run lint`
Attendu : aucune erreur.

Contrôle de non-régression navigateur, par lecture : sans shell,
`isDesktopShell` est faux, aucune classe n'est ajoutée, `style` vaut
`undefined`. La barre est identique à aujourd'hui.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/top-bar/index.tsx apps/client/src/index.css
git commit -m "feat(client): rendre la bande du haut deplacable dans le shell desktop"
```

---

### Tâche 4 : le seuil de version sans cadre — DESKTOP

**Fichiers :**

- Modifier : `src/main/servers/compat.ts`
- Modifier : `src/main/servers/compat.test.ts`

**Interfaces :**

- Consomme : `compareVersions` de `./version` (existant).
- Produit : `MIN_SERVER_VERSION_FRAMELESS: string | null` et
  `supportsFramelessWindow(version: string | null): boolean`.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à `src/main/servers/compat.test.ts` :

```ts
describe('supportsFramelessWindow', () => {
  test('version inconnue → cadre classique', () => {
    expect(supportsFramelessWindow(null)).toBe(false);
  });

  test('sous le seuil → cadre classique', () => {
    expect(supportsFramelessWindow('0.0.28')).toBe(false);
  });

  test('au seuil exact → sans cadre', () => {
    expect(supportsFramelessWindow('0.0.29')).toBe(true);
  });

  test('au-dessus du seuil → sans cadre', () => {
    expect(supportsFramelessWindow('0.1.0')).toBe(true);
  });

  test('le seuil est bien celui qui est publié', () => {
    expect(MIN_SERVER_VERSION_FRAMELESS).toBe('0.0.29');
  });
});
```

Compléter la ligne d'import en tête du fichier avec
`MIN_SERVER_VERSION_FRAMELESS` et `supportsFramelessWindow`.

- [ ] **Étape 2 : vérifier que les tests échouent**

Lancer : `bun run test`
Attendu : ÉCHEC, `supportsFramelessWindow` n'est pas exportée.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `src/main/servers/compat.ts`, après les deux seuils existants :

```ts
// Version du serveur à partir de laquelle la page fournit une zone de
// glissement (-webkit-app-region), donc à partir de laquelle la fenêtre peut
// s'ouvrir sans cadre. VOLONTAIREMENT à l'écart d'evaluateCompat : ce verdict
// alimente la bannière de compatibilité, et un serveur plus ancien ne doit pas
// voir d'avertissement pour un changement purement cosmétique.
export const MIN_SERVER_VERSION_FRAMELESS: string | null = '0.0.29';

export const supportsFramelessWindow = (version: string | null): boolean =>
  version !== null &&
  MIN_SERVER_VERSION_FRAMELESS !== null &&
  compareVersions(version, MIN_SERVER_VERSION_FRAMELESS) >= 0;
```

Ne modifier ni `evaluateCompat` ni les deux constantes existantes.

- [ ] **Étape 4 : vérifier que les tests passent**

Lancer : `bun run test`
Attendu : les tests existants plus les 5 nouveaux, tous verts.

- [ ] **Étape 5 : portes et commit**

```bash
bun run typecheck && bun run lint && bun run test
git add src/main/servers/compat.ts src/main/servers/compat.test.ts
git commit -m "feat: seuil de version pour la fenetre sans cadre"
```

---

### Tâche 5 : supprimer le menu Electron par défaut — DESKTOP

**Fichiers :**

- Modifier : `src/main/index.ts:28-35`
- Modifier : `src/main/windows/main-window.ts`

**Interfaces :**

- Consomme : rien.
- Produit : rien qu'une autre tâche importe.

Tâche indépendante des autres : elle peut être revue et jugée seule.

- [ ] **Étape 1 : supprimer le menu**

Dans `src/main/index.ts`, dans le `app.whenReady().then(...)`, **en première
ligne du bloc** :

```ts
    Menu.setApplicationMenu(null);
```

et compléter l'import d'`electron` en tête de fichier avec `Menu`.

- [ ] **Étape 2 : réenregistrer les deux raccourcis qui comptent**

Le menu par défaut est ce qui câblait `Ctrl+R` et les outils de développement :
les perdre ferait payer deux gestes pour la suppression d'une bande qu'on ne
voulait pas.

Dans `src/main/windows/main-window.ts`, dans `openServerWindow`, après la
création de la fenêtre :

```ts
  // Le menu applicatif par défaut est supprimé (il n'a jamais été écrit pour
  // Bullshark) ; ces deux accélérateurs en venaient et sont les seuls à garder.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;

    const key = input.key.toLowerCase();

    if ((input.control || input.meta) && key === 'r') {
      mainWindow?.webContents.reload();
    } else if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      mainWindow?.webContents.toggleDevTools();
    }
  });
```

Ne pas passer par `globalShortcut` : ces raccourcis doivent agir sur la fenêtre
qui a le focus, pas sur tout le système. Le dépôt réserve `globalShortcut` aux
raccourcis vocaux (`src/main/hotkeys.ts`), qui eux sont volontairement globaux.

- [ ] **Étape 3 : vérifier**

Lancer : `bun run typecheck && bun run lint`
Attendu : aucune erreur.

Il n'y a pas de test automatisé pour ce comportement : il faut une fenêtre
Electron réelle. La vérification est celle de la tâche 7.

- [ ] **Étape 4 : commit**

```bash
git add src/main/index.ts src/main/windows/main-window.ts
git commit -m "feat: supprimer le menu Electron par defaut et regarder ses deux raccourcis utiles"
```

---

### Tâche 6 : ouvrir la fenêtre sans cadre — DESKTOP

**Fichiers :**

- Modifier : `src/main/windows/main-window.ts:95-142`
- Modifier : `src/main/index.ts:15`, `src/main/ipc.ts:67`, `src/main/tray.ts:45`
  (les appelants)

**Interfaces :**

- Consomme : `supportsFramelessWindow` (tâche 4), `fetchServerInfo` de
  `../servers/server-info` (existant, signature
  `(baseUrl, fetchImpl?, timeoutMs?) => Promise<{ version: string } | null>`).
- Produit : `openServerWindow(server: ServerEntry): Promise<void>` — la
  fonction devient **asynchrone**.

- [ ] **Étape 1 : rendre la fonction asynchrone et lire la version d'abord**

Dans `src/main/windows/main-window.ts`, au début d'`openServerWindow` :

```ts
export const openServerWindow = async (server: ServerEntry) => {
  if (!mainWindow) {
    // titleBarStyle se fixe à la construction de la fenêtre et ne se bascule
    // pas ensuite : la version doit être connue AVANT le new BrowserWindow.
    // Le coût de cet aller-retour est masqué, la fenêtre naît avec show: false.
    const info = await fetchServerInfo(server.url);
    const frameless = supportsFramelessWindow(info?.version ?? null);

    mainWindow = new BrowserWindow({
      width: 1100,
      height: 750,
      show: false,
      ...(frameless
        ? {
            titleBarStyle: 'hidden' as const,
            // Couleurs provisoires : le client annonce les siennes dès qu'il
            // est chargé. Ne PAS y mettre une couleur de marque, ce serait une
            // seconde source de vérité pour la palette.
            titleBarOverlay: {
              color: '#000000',
              symbolColor: '#ffffff',
              height: 48
            }
          }
        : {}),
      webPreferences: {
        // ... inchangé
      }
    });
```

`height: 48` doit rester égal à la hauteur de la bande du client (`h-12`,
48 px). Si l'une change un jour, l'autre aussi.

Le reste du corps de la fonction ne change pas.

- [ ] **Étape 2 : corriger l'appel récursif**

Toujours dans la même fonction, la branche de changement de serveur s'appelle
elle-même :

```ts
  } else {
    // Switching servers requires a fresh partition -> recreate the window.
    mainWindow.destroy();
    mainWindow = null;
    await openServerWindow(server);
    return;
  }
```

- [ ] **Étape 3 : corriger les trois autres appelants**

La fonction rend maintenant une promesse. Aux trois endroits, marquer
l'intention de ne pas l'attendre plutôt que de laisser un flottant :

- `src/main/index.ts:15` → `if (active) void openServerWindow(active);`
- `src/main/ipc.ts:67` → `void openServerWindow(server);`
- `src/main/tray.ts:45` → `if (next) void openServerWindow(next);`

`lint` signale les promesses non gérées : s'il proteste, c'est le signe qu'un
appelant a été oublié.

- [ ] **Étape 4 : vérifier**

Lancer : `bun run typecheck && bun run lint && bun run test`
Attendu : aucune erreur, tests existants toujours verts.

- [ ] **Étape 5 : commit**

```bash
git add src/main/windows/main-window.ts src/main/index.ts src/main/ipc.ts src/main/tray.ts
git commit -m "feat: ouvrir la fenetre serveur sans cadre quand le serveur le permet"
```

---

### Tâche 7 : recevoir les couleurs annoncées par le client — DESKTOP

**Fichiers :**

- Modifier : `src/shared/bridge.ts`
- Modifier : `src/preload/bridge.ts:89`
- Modifier : `src/main/windows/main-window.ts` (à côté du listener existant,
  ligne 25)

**Interfaces :**

- Consomme : le canal `BRIDGE.titleBarColors`, et `setTitleBarColors` appelé
  par le client (tâche 2).
- Produit : rien qu'une autre tâche importe. C'est ce qui fait suivre le thème
  aux boutons du système.

- [ ] **Étape 1 : déclarer le canal**

Dans `src/shared/bridge.ts`, ajouter à l'objet `BRIDGE` :

```ts
  titleBarColors: 'bridge:title-bar-colors' // remote → main ({ color, symbolColor })
```

- [ ] **Étape 2 : exposer la méthode à la page distante**

Dans `src/preload/bridge.ts`, dans l'objet passé à
`contextBridge.exposeInMainWorld('bullshark', ...)` :

```ts
  setTitleBarColors: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.send(BRIDGE.titleBarColors, colors),
```

- [ ] **Étape 3 : appliquer les couleurs côté main**

Dans `src/main/windows/main-window.ts`, à côté du listener
`BRIDGE.reloadRequest` (ligne 25), au niveau du module :

```ts
// Le client annonce les couleurs de son thème ; la superposition de la barre de
// titre les prend. Sans cadre uniquement : setTitleBarOverlay lève sur une
// fenêtre à cadre classique.
ipcMain.on(
  BRIDGE.titleBarColors,
  (event, colors: { color: string; symbolColor: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!win || win.isDestroyed()) return;

    try {
      win.setTitleBarOverlay({ ...colors, height: 48 });
    } catch {
      // Fenêtre ouverte avec son cadre (serveur sous le seuil) : il n'y a
      // simplement pas de superposition à colorer.
    }
  }
);
```

Le `try/catch` n'est pas de la prudence de principe : `setTitleBarOverlay` lève
si la fenêtre n'a pas été créée avec `titleBarStyle: 'hidden'`, ce qui est
exactement le cas d'un serveur sous le seuil.

Valider les deux couleurs reçues avant de les appliquer serait tentant ; ce
n'est pas nécessaire, elles viennent de notre propre client et Electron ignore
une valeur illisible.

- [ ] **Étape 4 : vérifier**

Lancer : `bun run typecheck && bun run lint && bun run test`
Attendu : aucune erreur.

- [ ] **Étape 5 : commit**

```bash
git add src/shared/bridge.ts src/preload/bridge.ts src/main/windows/main-window.ts
git commit -m "feat: faire suivre le theme aux boutons de la barre de titre"
```

---

## Après les 7 tâches

### La vérification qui compte

Aucune porte, aucun test unitaire ne peut juger ce chantier : il faut une
fenêtre Electron réelle et deux serveurs de versions différentes. Ces six
points sont à faire par l.user, dans l'ordre :

1. Aucune barre de titre système, aucun menu.
2. **Déplacer la fenêtre en attrapant la bande de recherche.** C'est le point
   de rupture du chantier.
3. Cliquer la pastille de recherche, les boutons vocaux et l'icône du panneau
   des membres : aucun ne doit être mort.
4. Changer de thème : les boutons du système changent de couleur avec lui.
5. Pointer un serveur plus ancien que `0.0.29` : la fenêtre revient avec son
   cadre, **sans bannière**, et se déplace normalement.
6. `Ctrl+R` recharge, `F12` ouvre les outils de développement.

Le point 3 est celui que les portes ratent le plus volontiers : une région de
glissement mal posée ne produit aucune erreur, juste un bouton qui ne répond
plus.

### L'ordre de publication, qui n'est pas négociable

1. Fusionner et **publier le client** (tâches 1 à 3) dans une version `0.0.29`
   du serveur.
2. Seulement ensuite, fusionner et publier le shell (tâches 4 à 7).

Dans l'autre ordre, un shell sans cadre chargerait un serveur sans zone de
glissement, et la fenêtre serait bloquée à l'écran.

Si la version publiée du serveur n'est finalement pas `0.0.29`, corriger
`MIN_SERVER_VERSION_FRAMELESS` **et son test** avant de publier le shell.
