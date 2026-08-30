# Chrome de la fenêtre — design

- Date : 2026-08-28
- Statut : validé en chat sur maquette, prêt pour le plan d'implémentation
- Chantier A du programme « l'appli desktop n'est pas aussi propre que Discord »
- Traverse deux dépôts : `bullshark-desktop` (ce dépôt) et `bullshark` (client)

Maquette avant/après validée :
https://claude.ai/code/artifact/4201151b-b1f2-4a6e-8058-7ba9ec7634c2

## Problème

Avant que l'application commence, l'utilisateur traverse deux bandes qui ne lui
appartiennent pas, puis deux qui lui appartiennent. Constaté sur capture d'écran
de l.user le 2026-08-28, appli 0.1.6 :

| Bande | Hauteur | Origine |
| --- | --- | --- |
| Barre de titre Windows | 32 px | système |
| Menu `File / Edit / View / Window / Help` | 26 px | **Electron, par défaut** |
| Bande de recherche du client | 48 px | Bullshark |
| En-tête de salon | 48 px | Bullshark |

**154 px avant le premier message**, dont 58 px que personne n'a dessinés.

Le menu n'est pas un choix : `Menu.setApplicationMenu` n'est appelé nulle part
dans le dépôt (seul `src/main/tray.ts` construit un menu, celui du tray). C'est
le menu que fabrique Electron quand on ne lui en donne pas. Ses entrées `Edit`,
`Window` et `Help` n'ont aucun rapport avec Bullshark.

La fenêtre serveur est une `BrowserWindow` sans option de cadre
(`src/main/windows/main-window.ts:98`) : elle prend donc le cadre du système.

Discord, la référence citée par l.user, n'a ni l'un ni l'autre : fenêtre sans
cadre, barre de titre dessinée par l'application.

## Contraintes structurantes relevées dans le code

Cinq faits contraignent le design ; tous vérifiés avant d'écrire cette spec.

**1. `titleBarStyle` se fixe à la construction.** Il n'existe aucune API pour
basculer une fenêtre existante entre « avec cadre » et « sans cadre ». La
décision doit donc être prise **avant** `new BrowserWindow`, alors que le shell
ne lit la version du serveur qu'après `did-finish-load`
(`main-window.ts:134`). L'ordre doit changer.

**2. Sans cadre, c'est la page qui fournit la zone de glissement.** La fenêtre
serveur charge une instance **distante**, de version arbitraire. Un serveur qui
ne connaît pas le mode sans cadre ne déclarera aucune région
`-webkit-app-region: drag` : la fenêtre deviendrait **impossible à déplacer**.
C'est le seul risque sérieux du chantier, et il exige une garde.

**3. Le mécanisme de garde existe déjà et n'a jamais servi.**
`src/main/servers/compat.ts` déclare `MIN_SERVER_VERSION_NATIVE_FEATURES`, à
`null`, avec ce commentaire : « Set MIN_SERVER_VERSION_NATIVE_FEATURES to the
server version where the window.bullshark companion change ships; until then
the layer is dormant. » `evaluateCompat` rend déjà un verdict
`native-unavailable` pour ce cas.

**Mais le câbler tel quel serait une faute** : ce verdict alimente
`sendCompatBanner`, qui injecte une bannière orange dans la page. Tous les
serveurs antérieurs verraient donc un avertissement permanent **pour un
changement purement cosmétique**. Le chantier ajoute une constante distincte,
dans le même fichier pour garder la source unique de vérité, consommée
uniquement par la décision d'ouverture de fenêtre et jamais par la bannière.

**4. Windows peint les boutons avec une couleur qu'on donne une fois.**
`titleBarOverlay` prend `color` et `symbolColor` à la construction. Or Bullshark
a **cinq thèmes plus un thème sur mesure** : une couleur figée jurerait avec
quatre thèmes sur cinq. `BrowserWindow.setTitleBarOverlay()` est appelable à
chaud — le client doit donc annoncer ses couleurs, et les réannoncer à chaque
changement de thème.

**5. Le pont existe déjà, dans les deux sens.** `src/preload/bridge.ts:89`
expose `window.bullshark` à la page distante, avec `isDesktop: true`, et le
client s'en sert déjà (`components/voice-provider/hooks/use-desktop-bridge.ts`
pour le raccourci de coupure micro). Il n'y a ni pont à créer ni détection à
inventer.

## Direction retenue

La fenêtre passe **sans cadre avec superposition Windows**
(`titleBarStyle: 'hidden'` + `titleBarOverlay`). Le système continue de peindre
les trois boutons — on conserve donc gratuitement le survol qui propose les
dispositions d'écran et le comportement que les gens connaissent — mais dans
une bande qui appartient désormais à l'application.

**Aucune barre n'est ajoutée.** La bande de recherche du client, haute de
48 px, prend un deuxième métier : elle devient la barre de titre. Deux bandes
disparaissent, il en reste deux, et le bandeau passe de 154 px à **96 px**.

Le menu Electron par défaut disparaît.

## A. Le shell : ce qui change à l'ouverture de la fenêtre

`openServerWindow` (`main-window.ts:95`) devient asynchrone dans son amorce :
elle lit `/info` **avant** de construire la fenêtre, via le `fetchServerInfo`
qui existe (`src/main/servers/server-info.ts`), et en déduit un booléen.

```ts
// compat.ts, à côté des deux seuils existants
export const MIN_SERVER_VERSION_FRAMELESS: string | null = '0.0.29';

export const supportsFramelessWindow = (version: string | null): boolean =>
  version !== null &&
  MIN_SERVER_VERSION_FRAMELESS !== null &&
  compareVersions(version, MIN_SERVER_VERSION_FRAMELESS) >= 0;
```

`0.0.29` est la version du serveur qui embarquera le changement client décrit
en §B ; le dépôt `bullshark` est à `0.0.28` au moment d'écrire.
`supportsFramelessWindow` ne participe **pas** à `evaluateCompat` et ne peut
donc produire aucune bannière.

Les options de fenêtre en dépendent :

```ts
const frameless = supportsFramelessWindow(await peekServerVersion(server.url));

mainWindow = new BrowserWindow({
  width: 1100,
  height: 750,
  show: false,
  ...(frameless
    ? {
        titleBarStyle: 'hidden' as const,
        titleBarOverlay: { color: '#000000', symbolColor: '#ffffff', height: 48 }
      }
    : {}),
  webPreferences: { /* inchangé */ }
});
```

Les couleurs posées ici sont un **noir provisoire** : elles ne sont visibles que
pendant les quelques centaines de millisecondes avant que le client annonce les
siennes (§C). Ne pas y mettre une couleur de marque — ce serait une seconde
source de vérité pour la palette, exactement le défaut que le chantier B
poursuit.

`height: 48` fait correspondre la superposition à la hauteur de la bande du
client (`h-12`). Les deux valeurs doivent rester égales ; la spec les nomme
toutes les deux ici pour que ce lien soit écrit quelque part.

**Le doute retombe toujours du côté sûr.** Serveur injoignable, réponse
illisible, version absente : `supportsFramelessWindow` rend `false` et la
fenêtre garde son cadre. On ne perd que l'élégance, jamais la capacité de
déplacer sa fenêtre.

Le coût de la lecture préalable de `/info` est masqué : la fenêtre est déjà
créée avec `show: false` et ne s'affiche qu'au `ready-to-show`.

## B. Le client : ce qui rend la bande déplaçable

Tout ce qui suit est conditionné à `window.bullshark?.isDesktop`. Dans un
navigateur, rien ne change — et la bande est déjà `hidden lg:grid`, donc le
mobile et la PWA ne sont pas concernés du tout.

Sur `components/top-bar/index.tsx:29` :

- la bande entière devient une région de glissement
  (`-webkit-app-region: drag`) ;
- **tout ce qui est cliquable dedans redevient `no-drag`** : la pastille de
  recherche, les boutons vocaux, le rendu de greffons et l'icône du panneau des
  membres. Un contrôle laissé en `drag` cesse d'être cliquable — c'est le piège
  classique de ce mécanisme, et il ne produit aucune erreur, juste un bouton
  mort ;
- la colonne de droite gagne une réserve de la largeur des boutons système,
  sinon l'icône du panneau des membres passe dessous. Windows expose cette
  largeur au CSS via `env(titlebar-area-width)` et la famille
  `titlebar-area-*` ; s'en servir plutôt que d'écrire une constante, la largeur
  dépend de l'échelle d'affichage ;
- **la colonne gauche, aujourd'hui un `<div>` vide, sert enfin** : elle réserve
  la place des trois pastilles macOS, où les contrôles sont à gauche. Sur
  Windows elle reste vide, mais pour une raison.

## C. Les couleurs de la superposition

Le client annonce ses couleurs au montage et à chaque changement de thème, par
un membre ajouté au pont :

```ts
// preload/bridge.ts, dans l'objet exposé
setTitleBarColors: (colors: { color: string; symbolColor: string }) =>
  ipcRenderer.send(BRIDGE.titleBarColors, colors)
```

Le main appelle `mainWindow.setTitleBarOverlay(colors)` — **uniquement si la
fenêtre a été créée sans cadre**, l'appel étant sans effet sinon.

**Le piège de la conversion.** `setTitleBarOverlay` veut une couleur que Windows
sait peindre ; les jetons du client sont en `oklch`. Ne pas les passer tels
quels, et ne pas se fier à `getComputedStyle(...).backgroundColor` : Chromium ne
garantit pas de sérialiser une couleur `oklch` en `rgb()`, et selon la version
il rend `oklab(...)` ou `color(...)`. La conversion fiable est un aller-retour
par un canevas de 1 pixel : remplir avec la valeur du jeton, relire le pixel,
composer le hexadécimal. C'est déterministe et cela coûte une fois par
changement de thème.

Les deux couleurs à annoncer sont `--card` (le fond de la bande) et
`--foreground` (les symboles), pour que les boutons soient exactement sur le
fond qu'ils recouvrent.

## D. Ce que devient le menu

`Menu.setApplicationMenu(null)` au démarrage. Mais le menu par défaut est aussi
ce qui câble des accélérateurs utiles : les supprimer sans rien faire ferait
perdre deux gestes en retirant une bande qu'on ne voulait pas.

- **Recharger** (`Ctrl+R` / `F5`) et **outils de développement**
  (`Ctrl+Maj+I` / `F12`) : réenregistrés explicitement sur la fenêtre, via
  `before-input-event` ou un menu applicatif réduit et masqué. Choisir l'un des
  deux et s'y tenir.
- **Quitter** : déjà dans le menu du tray (`src/main/tray.ts:26`), qui est le
  vrai chemin de sortie — la fermeture de la fenêtre ne fait que masquer
  (`main-window.ts:114`).
- **Le reste** (`Edit`, `Window`, `Help`) : du boilerplate Electron. Rien à
  récupérer.

La fenêtre locale du shell (`src/main/windows/local-renderer.ts`, qui porte les
pages Serveurs et Onboarding) reçoit le même traitement de menu. Son passage
sans cadre n'est **pas** dans ce chantier : ses pages sont locales et devront
dessiner leur propre barre, ce qui est un travail de conception à part.

## Séquencement entre les deux dépôts

L'ordre n'est pas négociable :

1. Le changement client (§B, §C) est fusionné et **publié dans une version du
   serveur**, `0.0.29`.
2. Le shell (§A, §D) fixe `MIN_SERVER_VERSION_FRAMELESS` à cette version exacte
   et est publié ensuite.

Dans l'autre ordre, un shell sans cadre chargerait un serveur sans zone de
glissement et l'utilisateur se retrouverait avec une fenêtre bloquée.

## Vérification

Portes des deux dépôts à zéro erreur. Côté desktop, `bun test` existe déjà et
`compat.test.ts` teste les seuils : `supportsFramelessWindow` reçoit ses tests
au même endroit — sous le seuil, au-dessus, à l'égalité, et `null`.

**Vérification centrale, celle qu'aucune porte ne peut faire.** Ouvrir
l'application et, dans l'ordre :

1. aucune barre de titre système, aucun menu ;
2. **déplacer la fenêtre en attrapant la bande de recherche** — c'est le point
   de rupture du chantier ;
3. cliquer la pastille de recherche, les boutons vocaux et l'icône du panneau
   des membres : aucun ne doit être mort ;
4. changer de thème : les boutons du système changent de couleur avec lui ;
5. pointer un serveur volontairement plus ancien que le seuil : la fenêtre
   revient avec son cadre, **sans bannière**, et se déplace normalement ;
6. `Ctrl+R` recharge, `F12` ouvre les outils.

Le point 5 est le seul qui prouve la garde, et il ne peut pas être automatisé
ici : il demande deux serveurs de versions différentes.

## Hors périmètre, assumé

- **La fenêtre locale du shell** (Serveurs, Onboarding) garde son cadre. Ses
  pages sont locales et devraient dessiner leur propre barre : c'est un autre
  chantier, avec ses propres questions de conception.
- **Le rail à bulles serveurs**, en pause depuis le 2026-07-13, reste en pause.
  Il demanderait l'architecture concurrente (`WebContentsView`, le shell peint
  par-dessus le contenu distant) ; l.user a tranché pour la superposition le
  2026-08-28. Si le rail revient, cette décision sera à rouvrir.
- **macOS et Linux** : rien n'est réservé pour eux, contrairement à ce que le
  §B laissait entendre. Les variables `titlebar-area-*` viennent de l'API Window
  Controls Overlay, exposée sur **Windows et Linux seulement** ; sur macOS le
  repli `0px` s'applique et la colonne gauche reste vide. `titleBarStyle:
  'hidden'` s'y comporte de toute façon différemment (pastilles natives, pas de
  superposition à colorer). À traiter le jour où une version macOS est
  réellement distribuée, avec une mesure ou une constante, pas ces variables.
- **Les quatre bandes ne deviennent pas une seule.** Fusionner l'en-tête de
  salon avec la bande de titre est le chantier suivant possible ; l.user n'a pas
  retenu « les bandes du haut » dans son diagnostic.
