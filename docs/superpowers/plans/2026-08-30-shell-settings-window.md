# Fenêtre de réglages du shell — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** donner au shell desktop un système de style, transformer sa page de
gestion en fenêtre de réglages à navigation latérale, y afficher la version, et
finir de traduire ses libellés.

**Architecture :** une copie figée du thème sombre de Bullshark, en CSS simple,
dans un fichier unique importé par le renderer. Le shell s'affiche avant qu'un
serveur soit connu, hors ligne, dans un autre build : il ne peut structurellement
pas emprunter les jetons servis par le serveur, d'où la copie plutôt qu'une
synchronisation. La page `Servers` devient une coquille à deux colonnes qui
choisit entre trois sections, chacune dans son propre fichier.

**Pile :** Electron 33, React 18, TypeScript, vitest, electron-vite. Pas de
Tailwind.

**Spec :** `docs/superpowers/specs/2026-08-30-shell-settings-window-design.md`

## Contraintes globales

- **Il n'y a pas de porte de formatage dans ce dépôt** : aucun script `format`,
  aucun `.prettierrc`. Ne pas lancer `format:check`, ne pas reformater les
  fichiers existants.
- Portes à zéro erreur : `bun run typecheck`, `bun run lint`, `bun run test`,
  `bun run build`.
- Le runner est **vitest** (`vitest run`), pas `bun test`. Les tests vivent à
  côté du fichier testé, en `*.test.ts`, et importent depuis `'vitest'`.
- **Une seule dépendance nouvelle est autorisée : `@fontsource/geist-sans`.**
  Aucune autre, ni de production ni de développement.
- **Ne pas ajouter de troisième preload, et ne faire partager aucun module
  d'exécution nouveau entre les preloads existants.** Un preload en bac à sable
  doit tenir dans un seul `.cjs` autonome ; c'est ce qui a produit
  l'application à écran blanc de la v0.1.0.
- La politique de sécurité du renderer est `default-src 'self'` sans directive
  `font-src`. **Aucune ressource distante**, police comprise.
- Messages de commit en français, préfixe conventional-commit, et les deux
  lignes de fin :
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01TNvYhypDKS2hNn9rZ7VdgL
  ```

## Ce que ce plan ne peut pas vérifier

Les tests de ce dépôt visent des **fonctions pures extraites** des modules qui
dépendent d'Electron ; aucun ne simule Electron, et le renderer n'a pas
d'infrastructure de test. Une seule tâche porte donc un vrai test automatique,
la tâche 2, et elle garde le défaut réellement probable : une clé traduite dans
deux langues sur sept. Le reste s'appuie sur les portes du dépôt et sur une
vérification humaine, listée à la fin. Le plan ne prétendra pas mieux.

## Carte des fichiers

| Fichier | Responsabilité | Tâche |
| --- | --- | --- |
| `src/renderer/theme.css` | créer — jetons copiés, remise à zéro, classes | 1 |
| `src/renderer/main.tsx` | modifier — importer le thème | 1 |
| `package.json` | modifier — `@fontsource/geist-sans` | 1 |
| `src/shared/i18n/messages.ts` | modifier — 14 clés × 7 locales | 2 |
| `src/shared/i18n/messages.test.ts` | créer — complétude du catalogue | 2 |
| `src/shared/ipc.ts` | modifier — canal `app:version` | 3 |
| `src/main/ipc.ts` | modifier — servir `app.getVersion()` | 3 |
| `src/preload/shell.ts` | modifier — exposer `version()` | 3 |
| `src/renderer/shell.d.ts` | modifier — déclarer `version()` | 3 |
| `src/renderer/pages/Servers.tsx` | réécrire — coquille à deux colonnes | 4 |
| `src/renderer/sections/ServersSection.tsx` | créer | 4 |
| `src/renderer/sections/HotkeysSection.tsx` | créer | 4 |
| `src/renderer/sections/AboutSection.tsx` | créer | 4 |
| `src/main/windows/local-renderer.ts` | modifier — accepter `minWidth`/`minHeight` | 4 |
| `src/main/windows/servers-window.ts` | modifier — taille de la fenêtre | 4 |
| `src/renderer/pages/Onboarding.tsx` | réécrire — même système | 5 |
| `src/renderer/pages/SharePicker.tsx` | modifier — même système | 6 |

---

### Tâche 1 : le système de style

**Fichiers :**

- Créer : `src/renderer/theme.css`
- Modifier : `src/renderer/main.tsx`
- Modifier : `package.json`

**Interfaces :**

- Consomme : rien.
- Produit : les classes CSS utilisées par les tâches 4, 5 et 6 :
  `app-shell`, `app-sidebar`, `app-brand`, `app-nav`, `app-nav-item`,
  `app-nav-item--active`, `app-sidebar-footer`, `app-content`,
  `app-section-title`, `app-card`, `app-row`, `app-field`, `app-input`,
  `app-button`, `app-button--primary`, `app-button--quiet`,
  `app-button--danger`, `app-error`, `app-muted`, `app-center`,
  `app-grid-sources`, `app-source`, `app-source-thumb`, `app-source-name`.

- [ ] **Étape 1 : ajouter la police**

```bash
npm install @fontsource/geist-sans
```

Vérifier que `package.json` liste `@fontsource/geist-sans` dans
`dependencies` et qu'aucune autre entrée n'a bougé.

- [ ] **Étape 2 : écrire le fichier de thème**

Créer `src/renderer/theme.css` :

```css
/* --------------------------------------------------------------------------
   Thème du shell — COPIE FIGÉE.

   Source de vérité : apps/client/src/index.css du dépôt `bullshark`, bloc
   `.dark`. Ces valeurs sont recopiées à la main et NE SE SYNCHRONISENT PAS.
   Quand le thème du client change, ce fichier doit être remis à jour ici.

   Pourquoi une copie : le shell s'affiche avant qu'un serveur soit connu, hors
   ligne, dans un autre build. Il ne peut pas demander ses jetons au serveur.

   Un seul thème, le sombre : le client en a cinq plus un sur mesure, et le
   shell ne peut pas savoir lequel est actif.

   Spec : docs/superpowers/specs/2026-08-30-shell-settings-window-design.md
   -------------------------------------------------------------------------- */

@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/600.css';

:root {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --sidebar: oklch(0.12 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.98 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --radius: 0.75rem;
  --font-sans: 'Geist Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}

/* Coquille à deux colonnes de la fenêtre de réglages. */
.app-shell {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100%;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 12px;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  font-weight: 600;
  font-size: 15px;
}

.app-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-nav-item {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  text-align: left;
  padding: 8px 10px;
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
}

.app-nav-item:hover {
  background: var(--muted);
  color: var(--foreground);
}

.app-nav-item--active {
  background: var(--muted);
  color: var(--foreground);
  font-weight: 500;
}

.app-sidebar-footer {
  margin-top: auto;
  padding: 0 10px;
  color: var(--muted-foreground);
  font-size: 12px;
}

.app-content {
  padding: 24px 28px;
  overflow-y: auto;
}

.app-section-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.app-card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin-bottom: 12px;
}

.app-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-field {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.app-input {
  flex: 1;
  min-width: 0;
  background: var(--input);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  padding: 8px 10px;
  font: inherit;
}

.app-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -1px;
}

.app-button {
  appearance: none;
  border: 1px solid var(--border);
  background: var(--muted);
  color: var(--foreground);
  font: inherit;
  padding: 8px 12px;
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
  white-space: nowrap;
}

.app-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.app-button--primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: transparent;
  font-weight: 500;
}

.app-button--quiet {
  background: transparent;
}

.app-button--danger {
  background: transparent;
  color: var(--destructive);
  border-color: var(--destructive);
}

.app-error {
  margin: 8px 0 0;
  color: var(--destructive);
}

.app-muted {
  color: var(--muted-foreground);
}

/* Onboarding : un seul bloc centré. */
.app-center {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.app-center .app-card {
  width: 100%;
  max-width: 420px;
  margin: 0;
}

/* Sélecteur de partage d'écran. */
.app-grid-sources {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-height: 380px;
  overflow: auto;
}

.app-source {
  appearance: none;
  text-align: left;
  padding: 8px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 4px);
  background: var(--card);
  color: var(--card-foreground);
  font: inherit;
}

.app-source:hover {
  border-color: var(--primary);
}

.app-source-thumb {
  width: 100%;
  height: 120px;
  object-fit: contain;
  background: var(--background);
  border-radius: calc(var(--radius) - 8px);
}

.app-source-name {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Étape 3 : importer le thème**

Remplacer `src/renderer/main.tsx` par :

```tsx
import { createRoot } from 'react-dom/client';
import './theme.css';
import { Router } from './router';
createRoot(document.getElementById('root')!).render(<Router />);
```

- [ ] **Étape 4 : vérifier que l'empaquetage ne casse pas**

C'est le contrôle qui compte à cette tâche : ajouter un import CSS dans
`main.tsx` est exactement le genre de changement qui peut réveiller le défaut
d'écran blanc de la v0.1.0.

Lancer : `bun run typecheck && bun run lint && bun run build`

Puis vérifier, dans cet ordre :

```bash
ls out/preload/
```
Attendu : **exactement** `bridge.cjs` et `shell.cjs`, et **aucun dossier
`chunks/`**. Si un dossier de chunks apparaît dans `out/preload`, s'arrêter :
les preloads ne sont plus autonomes.

```bash
ls out/renderer/assets/
```
Attendu : au moins un fichier `.css` et les `.woff2` de Geist. S'ils sont
absents, la police n'est pas empaquetée et la politique de sécurité la
bloquera à l'exécution.

- [ ] **Étape 5 : commit**

```bash
git add package.json package-lock.json src/renderer/theme.css src/renderer/main.tsx
git commit -m "feat: donner un systeme de style au shell"
```

---

### Tâche 2 : les clés de traduction

**Fichiers :**

- Modifier : `src/shared/i18n/messages.ts`
- Créer : `src/shared/i18n/messages.test.ts`

**Interfaces :**

- Consomme : `t(code, locale)` et le type `ErrorCode`, existants.
- Produit : treize codes nouveaux, utilisables par les tâches 4, 5 et 6 :
  `nav-servers`, `nav-hotkeys`, `nav-about`, `servers-open`, `servers-remove`,
  `servers-add`, `servers-checking`, `servers-empty`, `onboarding-title`,
  `onboarding-hint`, `onboarding-connect`, `share-picker-title`, `share-picker-cancel`,
  `about-version`.

**Pourquoi un test ici et nulle part ailleurs.** C'est la seule logique de ce
chantier où un défaut est à la fois probable et invisible : ajouter une clé
dans deux langues sur sept ne casse ni la compilation ni le lint, et ne se voit
qu'en changeant la langue du système.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `src/shared/i18n/messages.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { SUPPORTED_LOCALES } from './locales';
import { ERROR_CODES, MESSAGES } from './messages';

describe('catalogue de messages', () => {
  test('chaque code a une entrée', () => {
    for (const code of ERROR_CODES) {
      expect(MESSAGES[code], `code manquant: ${code}`).toBeDefined();
    }
  });

  test('chaque code est traduit dans les sept locales', () => {
    for (const code of ERROR_CODES) {
      for (const locale of SUPPORTED_LOCALES) {
        const value = MESSAGES[code]?.[locale];
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `traduction manquante: ${code}/${locale}`
        ).toBe(true);
      }
    }
  });

  test('les codes de la fenêtre de réglages sont présents', () => {
    for (const code of [
      'nav-servers',
      'nav-hotkeys',
      'nav-about',
      'servers-open',
      'servers-remove',
      'servers-add',
      'servers-checking',
      'servers-empty',
      'onboarding-title',
      'onboarding-hint',
      'onboarding-connect',
      'share-picker-title',
      'share-picker-cancel',
      'about-version'
    ] as const) {
      expect(ERROR_CODES).toContain(code);
    }
  });
});
```

- [ ] **Étape 2 : vérifier que le test échoue**

Lancer : `bun run test`
Attendu : ÉCHEC sur le troisième test, les codes n'existent pas encore.

- [ ] **Étape 3 : déclarer les codes**

Dans `src/shared/i18n/messages.ts`, ajouter à la fin du tableau
`ERROR_CODES`, avant le `] as const;` :

```ts
  'nav-servers',
  'nav-hotkeys',
  'nav-about',
  'servers-open',
  'servers-remove',
  'servers-add',
  'servers-checking',
  'servers-empty',
  'onboarding-title',
  'onboarding-hint',
  'onboarding-connect',
  'share-picker-title',
  'share-picker-cancel',
  'about-version',
```

- [ ] **Étape 4 : écrire les traductions**

Dans le même fichier, ajouter à la fin de l'objet `MESSAGES` :

```ts
  'nav-servers': {
    en: 'Servers',
    fr: 'Serveurs',
    es: 'Servidores',
    it: 'Server',
    cs: 'Servery',
    ru: 'Серверы',
    zh: '服务器'
  },
  'nav-hotkeys': {
    en: 'Shortcuts',
    fr: 'Raccourcis',
    es: 'Atajos',
    it: 'Scorciatoie',
    cs: 'Zkratky',
    ru: 'Горячие клавиши',
    zh: '快捷键'
  },
  'nav-about': {
    en: 'About',
    fr: 'À propos',
    es: 'Acerca de',
    it: 'Informazioni',
    cs: 'O aplikaci',
    ru: 'О программе',
    zh: '关于'
  },
  'servers-open': {
    en: 'Open',
    fr: 'Ouvrir',
    es: 'Abrir',
    it: 'Apri',
    cs: 'Otevřít',
    ru: 'Открыть',
    zh: '打开'
  },
  'servers-remove': {
    en: 'Remove',
    fr: 'Retirer',
    es: 'Quitar',
    it: 'Rimuovi',
    cs: 'Odebrat',
    ru: 'Удалить',
    zh: '移除'
  },
  'servers-add': {
    en: 'Add',
    fr: 'Ajouter',
    es: 'Añadir',
    it: 'Aggiungi',
    cs: 'Přidat',
    ru: 'Добавить',
    zh: '添加'
  },
  'servers-checking': {
    en: 'Checking…',
    fr: 'Vérification…',
    es: 'Comprobando…',
    it: 'Verifica…',
    cs: 'Kontrola…',
    ru: 'Проверка…',
    zh: '检查中…'
  },
  'servers-empty': {
    en: 'No server yet. Add one below.',
    fr: 'Aucun serveur pour le moment. Ajoutes-en un ci-dessous.',
    es: 'Aún no hay servidores. Añade uno abajo.',
    it: 'Nessun server per ora. Aggiungine uno qui sotto.',
    cs: 'Zatím žádný server. Přidej ho níže.',
    ru: 'Пока нет серверов. Добавьте один ниже.',
    zh: '还没有服务器。在下面添加一个。'
  },
  'onboarding-title': {
    en: 'Connect to your Bullshark server',
    fr: 'Connecte-toi à ton serveur Bullshark',
    es: 'Conéctate a tu servidor Bullshark',
    it: 'Collegati al tuo server Bullshark',
    cs: 'Připoj se ke svému serveru Bullshark',
    ru: 'Подключитесь к своему серверу Bullshark',
    zh: '连接到你的 Bullshark 服务器'
  },
  'onboarding-hint': {
    en: 'Enter the address of your Bullshark instance.',
    fr: "Saisis l'adresse de ton instance Bullshark.",
    es: 'Introduce la dirección de tu instancia Bullshark.',
    it: "Inserisci l'indirizzo della tua istanza Bullshark.",
    cs: 'Zadej adresu své instance Bullshark.',
    ru: 'Введите адрес вашего экземпляра Bullshark.',
    zh: '输入你的 Bullshark 实例地址。'
  },
  'onboarding-connect': {
    en: 'Connect',
    fr: 'Se connecter',
    es: 'Conectar',
    it: 'Connetti',
    cs: 'Připojit',
    ru: 'Подключиться',
    zh: '连接'
  },
  'share-picker-title': {
    en: 'Share your screen',
    fr: 'Partager ton écran',
    es: 'Comparte tu pantalla',
    it: 'Condividi lo schermo',
    cs: 'Sdílet obrazovku',
    ru: 'Поделиться экраном',
    zh: '共享你的屏幕'
  },
  'share-picker-cancel': {
    en: 'Cancel',
    fr: 'Annuler',
    es: 'Cancelar',
    it: 'Annulla',
    cs: 'Zrušit',
    ru: 'Отмена',
    zh: '取消'
  },
  'about-version': {
    en: 'Version',
    fr: 'Version',
    es: 'Versión',
    it: 'Versione',
    cs: 'Verze',
    ru: 'Версия',
    zh: '版本'
  },
```

- [ ] **Étape 5 : vérifier que les tests passent**

Lancer : `bun run test`
Attendu : les 94 tests existants plus les 3 nouveaux, tous verts.

- [ ] **Étape 6 : portes et commit**

```bash
bun run typecheck && bun run lint && bun run test
git add src/shared/i18n/messages.ts src/shared/i18n/messages.test.ts
git commit -m "feat(i18n): ajouter les cles de la fenetre de reglages"
```

---

### Tâche 3 : le canal de version

**Fichiers :**

- Modifier : `src/shared/ipc.ts`
- Modifier : `src/main/ipc.ts`
- Modifier : `src/preload/shell.ts`
- Modifier : `src/renderer/shell.d.ts`

**Interfaces :**

- Consomme : rien.
- Produit : `window.shell.version(): Promise<string>`, utilisé par la tâche 4.

**Pas de test unitaire ici, et c'est délibéré.** Les tests de ce dépôt visent
des fonctions pures ; `() => app.getVersion()` n'en est pas une et ne porte
aucune logique. Un test qui simulerait Electron testerait le simulacre.

- [ ] **Étape 1 : déclarer le canal**

Dans `src/shared/ipc.ts`, ajouter à l'objet `IPC`, après `appLocale` :

```ts
  appVersion: 'app:version',
```

- [ ] **Étape 2 : le servir**

Dans `src/main/ipc.ts`, à côté de la ligne qui sert `IPC.appLocale` :

```ts
  ipcMain.handle(IPC.appVersion, () => app.getVersion());
```

`app` est déjà importé dans ce fichier pour `app.getLocale()` ; ne pas ajouter
d'import.

- [ ] **Étape 3 : l'exposer**

Dans `src/preload/shell.ts`, dans l'objet passé à `exposeInMainWorld`, à côté
de `locale` :

```ts
  version: (): Promise<string> => ipcRenderer.invoke(IPC.appVersion),
```

- [ ] **Étape 4 : le déclarer**

Dans `src/renderer/shell.d.ts`, dans l'interface `shell`, à côté de `locale` :

```ts
      version: () => Promise<string>;
```

- [ ] **Étape 5 : portes et commit**

```bash
bun run typecheck && bun run lint && bun run test
git add src/shared/ipc.ts src/main/ipc.ts src/preload/shell.ts src/renderer/shell.d.ts
git commit -m "feat: exposer la version de l'application au renderer"
```

---

### Tâche 4 : la fenêtre de réglages

**Fichiers :**

- Réécrire : `src/renderer/pages/Servers.tsx`
- Créer : `src/renderer/sections/ServersSection.tsx`
- Créer : `src/renderer/sections/HotkeysSection.tsx`
- Créer : `src/renderer/sections/AboutSection.tsx`
- Modifier : `src/main/windows/servers-window.ts`

**Interfaces :**

- Consomme : les classes de la tâche 1, les codes de la tâche 2,
  `window.shell.version()` de la tâche 3.
- Produit : rien qu'une autre tâche importe.

Chaque section reçoit `locale: Locale` en propriété et gère son propre état.
La page ne garde que la sélection de section.

- [ ] **Étape 1 : la section Serveurs**

Créer `src/renderer/sections/ServersSection.tsx` :

```tsx
import { useEffect, useState } from 'react';
import type { ServerEntry } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const ServersSection = ({ locale }: { locale: Locale }) => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => {
    void refresh();
    return window.shell.onServersChanged(refresh);
  }, []);

  const add = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) {
        setError(t(v.reason ?? 'unreachable', locale));
        return;
      }
      const r = await window.shell.servers.add(url, '');
      if (r.ok) setUrl('');
      else setError(t(r.reason ?? 'unreachable', locale));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <h2 className="app-section-title">{t('nav-servers', locale)}</h2>

      {servers.length === 0 && (
        <p className="app-muted">{t('servers-empty', locale)}</p>
      )}

      {servers.map((s) => (
        <div key={s.id} className="app-card app-row">
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.label || s.url}
          </span>
          <button
            className="app-button"
            onClick={() => window.shell.servers.switchTo(s.id)}
          >
            {t('servers-open', locale)}
          </button>
          <button
            className="app-button app-button--danger"
            onClick={() => window.shell.servers.remove(s.id)}
          >
            {t('servers-remove', locale)}
          </button>
        </div>
      ))}

      <div className="app-field">
        <input
          className="app-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chat.example.com"
        />
        <button
          className="app-button app-button--primary"
          onClick={add}
          disabled={checking}
        >
          {checking ? t('servers-checking', locale) : t('servers-add', locale)}
        </button>
      </div>

      {error && <p className="app-error">{error}</p>}
    </>
  );
};
```

- [ ] **Étape 2 : la section Raccourcis**

Créer `src/renderer/sections/HotkeysSection.tsx` :

```tsx
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Prefs } from '../../shared/types';
import { DEFAULT_MUTE_HOTKEY } from '../../shared/types';
import { eventToAccelerator } from '../../shared/hotkey-capture';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const HotkeysSection = ({ locale }: { locale: Locale }) => {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    void window.shell.prefs.get().then(setPrefs);
  }, []);

  const saveHotkey = async (muteHotkey: string) => {
    await window.shell.prefs.set({ muteHotkey });
    setPrefs(await window.shell.prefs.get());
  };

  const onHotkeyKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      void saveHotkey('');
      return;
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      return;
    }
    const accelerator = eventToAccelerator(e);
    if (accelerator) void saveHotkey(accelerator);
  };

  const hotkeyDisplay =
    prefs === null
      ? ''
      : prefs.muteHotkey.trim() === ''
        ? t('mute-hotkey-disabled', locale)
        : prefs.muteHotkey;

  return (
    <>
      <h2 className="app-section-title">{t('nav-hotkeys', locale)}</h2>

      <div className="app-card">
        <div className="app-muted">{t('mute-hotkey-label', locale)}</div>
        <div className="app-field">
          <input
            className="app-input"
            readOnly
            value={hotkeyDisplay}
            onKeyDown={onHotkeyKeyDown}
            placeholder={t('mute-hotkey-hint', locale)}
            title={t('mute-hotkey-hint', locale)}
          />
          <button
            className="app-button"
            onClick={() => void saveHotkey(DEFAULT_MUTE_HOTKEY)}
          >
            {t('mute-hotkey-reset', locale)}
          </button>
        </div>
      </div>
    </>
  );
};
```

- [ ] **Étape 3 : la section À propos**

Créer `src/renderer/sections/AboutSection.tsx` :

```tsx
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const AboutSection = ({
  locale,
  version
}: {
  locale: Locale;
  version: string;
}) => (
  <>
    <h2 className="app-section-title">{t('nav-about', locale)}</h2>

    <div className="app-card">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Bullshark</div>
      <div className="app-muted">
        {t('about-version', locale)} {version || '—'}
      </div>
    </div>
  </>
);
```

Aucun contrôle de mise à jour ici : ils appartiennent au chantier de la
pastille, hors périmètre.

- [ ] **Étape 4 : la coquille**

Remplacer entièrement `src/renderer/pages/Servers.tsx` par :

```tsx
import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';
import { AboutSection } from '../sections/AboutSection';
import { HotkeysSection } from '../sections/HotkeysSection';
import { ServersSection } from '../sections/ServersSection';

type Section = 'servers' | 'hotkeys' | 'about';

const SECTIONS: { id: Section; code: 'nav-servers' | 'nav-hotkeys' | 'nav-about' }[] = [
  { id: 'servers', code: 'nav-servers' },
  { id: 'hotkeys', code: 'nav-hotkeys' },
  { id: 'about', code: 'nav-about' }
];

export const Servers = () => {
  const [locale, setLocale] = useState<Locale>('en');
  const [version, setVersion] = useState('');
  const [section, setSection] = useState<Section>('servers');

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);
  useEffect(() => {
    void window.shell.version().then(setVersion);
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">Bullshark</div>

        <nav className="app-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={
                s.id === section
                  ? 'app-nav-item app-nav-item--active'
                  : 'app-nav-item'
              }
              onClick={() => setSection(s.id)}
            >
              {t(s.code, locale)}
            </button>
          ))}
        </nav>

        <div className="app-sidebar-footer">v{version || '—'}</div>
      </aside>

      <main className="app-content">
        {section === 'servers' && <ServersSection locale={locale} />}
        {section === 'hotkeys' && <HotkeysSection locale={locale} />}
        {section === 'about' && (
          <AboutSection locale={locale} version={version} />
        )}
      </main>
    </div>
  );
};
```

- [ ] **Étape 5 : agrandir la fenêtre**

`createLocalWindow` n'accepte aujourd'hui que `width` et `height` ; il faut
donc d'abord élargir sa signature. Dans `src/main/windows/local-renderer.ts`,
remplacer la signature et la construction de la fenêtre par :

```ts
export const createLocalWindow = (
  route: string,
  opts?: { width?: number; height?: number; minWidth?: number; minHeight?: number }
) => {
  const win = new BrowserWindow({
    width: opts?.width ?? 520,
    height: opts?.height ?? 600,
    ...(opts?.minWidth !== undefined ? { minWidth: opts.minWidth } : {}),
    ...(opts?.minHeight !== undefined ? { minHeight: opts.minHeight } : {}),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.cjs')
    }
  });
```

Le reste du corps de la fonction ne change pas. Les deux options sont diffusées
conditionnellement pour que l'écran d'accueil, qui ne les passe pas, garde
exactement le comportement qu'il a aujourd'hui.

Puis, dans `src/main/windows/servers-window.ts`, remplacer la ligne
`openServersManager` par :

```ts
export const openServersManager = () =>
  createLocalWindow('/servers', { width: 780, height: 560, minWidth: 680, minHeight: 460 });
```

Une barre latérale de 200 px plus un contenu utile ne tient pas dans 560 px ;
la largeur minimale évite que la disposition se casse en dessous. C'est la même
leçon que le plancher de 1024 px du chantier A.

- [ ] **Étape 6 : vérifier**

Lancer : `bun run typecheck && bun run lint && bun run test && bun run build`
Attendu : aucune erreur.

- [ ] **Étape 7 : commit**

```bash
git add src/renderer/pages/Servers.tsx src/renderer/sections src/main/windows/local-renderer.ts src/main/windows/servers-window.ts
git commit -m "feat: transformer la page de gestion en fenetre de reglages"
```

---

### Tâche 5 : l'onboarding

**Fichiers :**

- Réécrire : `src/renderer/pages/Onboarding.tsx`

**Interfaces :**

- Consomme : les classes de la tâche 1, les codes de la tâche 2.
- Produit : rien qu'une autre tâche importe.

C'est le tout premier écran d'un nouvel utilisateur.

- [ ] **Étape 1 : réécrire la page**

Remplacer entièrement `src/renderer/pages/Onboarding.tsx` par :

```tsx
import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n/messages';
import type { Locale } from '../../shared/i18n/locales';

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);

  const onSubmit = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) {
        setError(t(v.reason ?? 'unreachable', locale));
        return;
      }
      const res = await window.shell.servers.add(url, '');
      if (res.ok && res.id) {
        await window.shell.servers.switchTo(res.id);
        window.close();
      } else {
        setError(t(res.reason ?? 'unreachable', locale));
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app-center">
      <div className="app-card">
        <h1 className="app-section-title">{t('onboarding-title', locale)}</h1>
        <p className="app-muted" style={{ marginTop: 0 }}>
          {t('onboarding-hint', locale)}
        </p>

        <div className="app-field">
          <input
            className="app-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://chat.example.com"
          />
          <button
            className="app-button app-button--primary"
            onClick={onSubmit}
            disabled={checking}
          >
            {checking
              ? t('servers-checking', locale)
              : t('onboarding-connect', locale)}
          </button>
        </div>

        {error && <p className="app-error">{error}</p>}
      </div>
    </div>
  );
};
```

- [ ] **Étape 2 : vérifier et commit**

```bash
bun run typecheck && bun run lint && bun run build
git add src/renderer/pages/Onboarding.tsx
git commit -m "feat: habiller l'ecran d'accueil"
```

---

### Tâche 6 : le sélecteur de partage d'écran

**Fichiers :**

- Réécrire : `src/renderer/pages/SharePicker.tsx`

**Interfaces :**

- Consomme : les classes de la tâche 1, les codes `share-picker-title` et
  `share-picker-cancel` de la tâche 2.
- Produit : rien.

Cette page porte les trois dernières couleurs en dur du dépôt, `#fff`, `#ccc`
et `#000`. Après cette tâche, il n'en reste aucune.

- [ ] **Étape 1 : réécrire la page**

Remplacer entièrement `src/renderer/pages/SharePicker.tsx` par :

```tsx
import { useEffect, useState } from 'react';
import type { SourceDto } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const SharePicker = () => {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    void window.shell.locale().then(setLocale);
  }, []);

  useEffect(() => {
    void window.shell.screen.getSources().then(setSources);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void window.shell.screen.cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-content">
      <h2 className="app-section-title">{t('share-picker-title', locale)}</h2>

      <div className="app-grid-sources">
        {sources.map((s) => (
          <button
            key={s.id}
            className="app-source"
            onClick={() => void window.shell.screen.choose(s.id)}
          >
            <img className="app-source-thumb" src={s.thumbnailDataUrl} alt="" />
            <div className="app-source-name">
              {s.appIconDataUrl && (
                <img src={s.appIconDataUrl} alt="" width={16} height={16} />
              )}
              <span>{s.name}</span>
            </div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button
          className="app-button"
          onClick={() => void window.shell.screen.cancel()}
        >
          {t('share-picker-cancel', locale)}
        </button>
      </div>
    </div>
  );
};
```

Le bouton « Cancel » était lui aussi codé en dur en anglais ; il passe par
`share-picker-cancel`. Aucun attribut fonctionnel n'a changé : `onClick`,
`src`, `alt` et `key` sont identiques, seuls les `style` cèdent la place aux
classes.

- [ ] **Étape 2 : vérifier qu'il ne reste aucune couleur en dur**

```bash
grep -rn "#fff\|#ccc\|#000\|crimson\|system-ui" src/renderer/
```
Attendu : **aucun résultat**. S'il en reste, ils appartiennent à cette tâche ou
à une précédente ; les traiter avant de commiter.

- [ ] **Étape 3 : vérifier et commit**

```bash
bun run typecheck && bun run lint && bun run test && bun run build
git add src/renderer/pages/SharePicker.tsx
git commit -m "feat: habiller le selecteur de partage d'ecran"
```

---

## Après les six tâches

### La vérification humaine

Les portes ne peuvent pas juger de l'apparence. Ces six points sont à faire par
l.user, en lançant l'application, dans l'ordre :

1. La fenêtre de réglages s'ouvre en deux colonnes, et les trois entrées de
   navigation basculent bien de section.
2. La version affichée, en pied de barre latérale et dans À propos, est celle
   de l'application installée.
3. Plus **aucun libellé anglais** dans une session en français. C'était le
   défaut le plus visible sur la capture d'origine.
4. Ajouter un serveur avec une URL invalide affiche l'erreur dans la couleur du
   thème, plus en `crimson`.
5. L'écran d'accueil et le sélecteur de partage d'écran ont la même allure que
   la fenêtre de réglages.
6. Réduire la fenêtre de réglages ne casse pas la disposition, et elle refuse
   de descendre sous 680 px de large.

### Ce qui reste dehors, et qu'il ne faut pas ajouter en route

- La bannière de compatibilité injectée par `src/preload/bridge.ts` : elle vit
  dans la page distante, ce sont les jetons du client qui doivent s'y
  appliquer.
- La pastille de mise à jour : chantier distinct, traverse les deux dépôts.
- Rendre les fenêtres du shell sans cadre.
- Une synchronisation automatique des jetons avec le client.
