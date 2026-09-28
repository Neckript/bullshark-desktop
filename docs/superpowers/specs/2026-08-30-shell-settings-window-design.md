# Fenêtre de réglages du shell — design

- Date : 2026-08-30
- Statut : validé en chat sur maquette, prêt pour le plan d'implémentation
- Chantier C du programme « l'appli desktop n'est pas aussi propre que Discord »
- Un seul dépôt : `bullshark-desktop`

Maquette retenue par l.user parmi trois proposées, reproduite ici **sans son
entrée « Apparence »**, retirée d'un commun accord (voir la section B) :

```
┌──────────────────────────────────────────┐
│ 🦈 Bullshark │                           │
│              │   Serveurs                │
│  Serveurs  ▸ │                           │
│  Raccourcis  │  ● bullshark.neckript.fr  │
│  À propos    │       [Ouvrir] [Retirer]  │
│              │                           │
│              │  ┌──────────────────────┐ │
│              │  │ https://chat.exemple │ │
│              │  └──────────────────────┘ │
│              │            [ Ajouter ]    │
│  v0.1.8      │                           │
└──────────────────────────────────────────┘
```

## Problème

Le shell desktop n'a **aucun système de style**. Ce n'est pas une question de
goût, c'est un constat de code :

- `src/renderer/pages/Servers.tsx` s'ouvre sur
  `<div style={{ padding: 24, fontFamily: 'system-ui' }}>` et son message
  d'erreur est `<p style={{ color: 'crimson' }}>`.
- `src/renderer/pages/Onboarding.tsx` a la même structure.
- `src/renderer/pages/SharePicker.tsx` porte les trois seules couleurs en dur
  du dépôt : `#fff`, `#ccc`, `#000`.
- Il n'existe **ni Tailwind, ni fichier CSS, ni jeton** dans tout le dépôt. Les
  dépendances de production se résument à `electron-store`, `electron-updater`,
  `react` et `react-dom`.

S'y ajoute un défaut de traduction visible à l'écran : « Servers », « Open »,
« Remove », « Add », « Checking… » sont **codés en dur en anglais**, juste
au-dessus de « Raccourci global du micro » qui, lui, passe par le système i18n
du shell et ses sept langues. La même fenêtre parle deux langues.

Enfin, **la version de l'application n'est exposée nulle part** vers le
renderer : aucun canal IPC ne la transporte, donc l'utilisateur ne peut pas
savoir ce qu'il fait tourner.

C'est la première chose que voit un nouvel utilisateur, juste avant d'entrer
dans une application en Geist et oklch. La couture est au pire endroit
possible.

## Contraintes structurantes relevées dans le code

**Le shell s'affiche avant qu'un serveur soit connu.** `openOnboarding()` est
appelée quand `store.getActive()` ne rend rien. À cet instant il n'y a pas
d'URL, pas de connexion, pas de thème à demander. Le shell ne peut donc pas
emprunter les jetons du client, ni au démarrage, ni hors ligne, ni dans une
version de serveur antérieure à celle qui les exposerait.

**La politique de sécurité du renderer interdit tout chargement distant.**
`src/renderer/index.html` porte
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`.
Il n'y a **pas de directive `font-src`**, donc `default-src 'self'` s'applique
aux polices : aucune police ne peut venir d'un CDN. Toute police doit être
empaquetée dans le build.

**Le shell a déjà un système i18n complet**, `src/shared/i18n/messages.ts` et
`src/shared/i18n/locales.ts`, avec la locale résolue côté main
(`resolveLocale(app.getLocale())`) et exposée au renderer par
`window.shell.locale()`. Il n'y a rien à construire, seulement des clés à
ajouter.

**Les deux preloads ne doivent partager aucun module d'exécution.** Un preload
en bac à sable doit tenir dans un seul `.cjs` autonome ; c'est ce qui a produit
l'application à écran blanc de la v0.1.0. `IPC` vit dans `src/shared/ipc.ts` et
`BRIDGE` dans `src/shared/bridge.ts` précisément pour cette raison. Ce chantier
n'ajoute pas de troisième preload et ne fait rien partager de neuf.

**Le runner de tests est vitest**, et il ne couvre que la logique du processus
principal. Le renderer n'a aucune infrastructure de test.

## Direction retenue

**Une copie figée du thème sombre de Bullshark, en CSS simple, sans Tailwind.**

Trois raisons, dans l'ordre de poids :

1. Le shell ne peut pas apprendre le thème du serveur, pour la raison
   structurelle ci-dessus. La question laissée ouverte le 2026-08-28 est donc
   tranchée par la contrainte, pas par la préférence.
2. Le dépôt n'a aucune chaîne CSS. Greffer Tailwind 4 et PostCSS sur
   electron-vite pour trois pages est disproportionné.
3. Un fichier de jetons explicite se relit et se compare à la main.

**Un seul thème, le sombre.** Le client en compte cinq plus un sur mesure ; le
shell ne peut pas savoir lequel est actif. Le sombre est celui par défaut de
l'application.

**Le compromis assumé : la dérive.** Ces jetons se désynchroniseront du client
le jour où son thème changera. C'est le prix de l'autonomie du shell. On le
limite en n'ayant qu'un seul fichier, en n'y copiant que les jetons réellement
utilisés, et en y inscrivant en commentaire d'où ils viennent.

## A. Le système de style

Créer `src/renderer/theme.css`, importé une fois depuis
`src/renderer/main.tsx`.

Il contient, dans cet ordre :

1. Un en-tête de commentaire nommant sa source de vérité,
   `apps/client/src/index.css` du dépôt `bullshark`, et disant explicitement
   que c'est une copie figée qui doit être remise à jour à la main.
2. Les imports `@fontsource/geist-sans` pour les graisses 400, 500 et 600.
3. Un bloc `:root` portant uniquement les jetons utilisés :
   `--background`, `--foreground`, `--card`, `--card-foreground`, `--border`,
   `--input`, `--primary`, `--primary-foreground`, `--muted`,
   `--muted-foreground`, `--destructive`, `--radius`, `--font-sans`. Valeurs
   `oklch` reprises telles quelles du thème sombre du client.
4. Une remise à zéro minimale et un petit jeu de classes applicatives :
   disposition en barre latérale, carte, champ, bouton primaire, bouton
   discret, bouton destructeur, libellé de section, texte d'erreur.

**Une dépendance nouvelle, `@fontsource/geist-sans`.** Elle est nécessaire et
non cosmétique : la police est ce qui fait qu'une fenêtre appartient à
Bullshark, et la politique de sécurité interdit un CDN. C'est le paquet npm
déjà utilisé par le client, et Vite empaquette les `woff2` localement, ce qui
satisfait `default-src 'self'`.

Aucune autre dépendance.

## B. La fenêtre de réglages

`src/renderer/pages/Servers.tsx` devient une fenêtre à deux colonnes.

**Barre latérale.** En haut, le logo et le nom. Au milieu, trois entrées de
navigation : Serveurs, Raccourcis, À propos. En pied, la version, en texte
discret.

**Contenu.** La section sélectionnée. L'état de sélection est un `useState`
local ; il n'y a pas de routeur à ajouter, `src/renderer/router.tsx` gère des
fenêtres, pas des sections.

- **Serveurs** : la liste, chaque entrée avec son URL et ses deux actions
  Ouvrir et Retirer ; puis le champ d'ajout et son bouton.
- **Raccourcis** : le raccourci micro, son champ de capture et son bouton de
  réinitialisation. Comportement inchangé.
- **À propos** : le nom, la version, et le lien du dépôt. **Aucun contrôle de
  mise à jour** : ils appartiennent au chantier de la pastille.

**« Apparence » est délibérément absente**, bien que présente dans la maquette
choisie. Le shell n'a rien à y configurer aujourd'hui, et une entrée de
navigation ouvrant une page vide est pire que son absence.

**La fenêtre passe de 560 × 640 à 780 × 560**, avec une largeur minimale de
680 px. Une barre latérale plus un contenu dans 560 px serait à l'étroit ; la
largeur minimale évite que la disposition se casse en dessous. C'est la même
leçon que le plancher de 1024 px du chantier A.

**Elle garde sa barre de titre Windows native.** La rendre sans cadre serait
cohérent mais relève du chantier A, et ajouterait du risque à un chantier qui
n'en a pas besoin.

## C. Les deux autres pages

`Onboarding.tsx` reçoit le même système : un bloc centré, le champ d'URL, le
bouton, le message d'erreur en `--destructive`. C'est le tout premier écran
d'un nouvel utilisateur.

`SharePicker.tsx` reçoit le même système, ce qui fait disparaître `#fff`,
`#ccc` et `#000`, les trois dernières couleurs en dur du dépôt.

Les laisser dehors reviendrait à déplacer la couture au lieu de la coudre.

## D. Les libellés

Faire passer par `t()` les chaînes aujourd'hui codées en dur : « Servers »,
« Open », « Remove », « Add », « Checking… », « Connect to your Bullshark
server », « Enter the URL of your Bullshark instance. », « Connect », « Share
your screen », plus les titres des trois sections et les libellés d'À propos.

Ajouter les clés correspondantes dans **les sept locales** de
`src/shared/i18n/messages.ts`.

## E. La version

Un seul canal IPC nouveau : `appVersion: 'app:version'` dans
`src/shared/ipc.ts`, servi côté main par `app.getVersion()`, exposé en
`window.shell.version()` dans `src/preload/shell.ts` et déclaré dans
`src/renderer/shell.d.ts`.

Tout le reste du dialogue avec le main existe déjà.

## Vérification

**Il faut le dire franchement : aucun test automatique ne peut juger de
l'apparence.** Les 94 tests vitest portent sur la logique du processus
principal, et le renderer n'a pas d'infrastructure de test. Ce chantier ne
prétendra pas le contraire.

Ce qui est verrouillable :

1. **Un test du canal de version**, côté main : `app:version` rend bien ce que
   `app.getVersion()` rend. Petit, mais c'est la seule logique neuve.
2. **Le contrôle d'empaquetage déjà pratiqué sur ce dépôt** : charger le
   `out/renderer/index.html` construit avec son preload et vérifier que `#root`
   se remplit. Il protège de l'écran blanc, le défaut qui a mordu en v0.1.0, et
   l'ajout d'un import CSS dans `main.tsx` est exactement le genre de
   changement qui peut le réveiller.
3. **Les portes du dépôt** : `bun run typecheck`, `bun run lint`,
   `bun run test`, `bun run build`.

Le reste est humain, et la liste est courte :

- les trois sections s'affichent et la navigation fonctionne ;
- la version affichée est la bonne ;
- plus un seul libellé anglais dans une session française ;
- l'onboarding et le sélecteur de partage d'écran ont la même allure ;
- réduire la fenêtre ne casse pas la disposition.

## Hors périmètre, assumé

**La bannière de compatibilité** injectée par `src/preload/bridge.ts` en DOM
brut, `system-ui` et `#c0392b`. Elle mérite la même correction, mais elle vit
dans la **page distante** : ce sont les jetons du client qui doivent s'y
appliquer, pas ceux du shell. C'est un chantier distinct, plus petit.

**La pastille de mise à jour.** Demandée par l.user le même jour, elle traverse
les deux dépôts et impose un ordre de publication ; ce chantier-ci n'en impose
aucun. Emplacement déjà repéré : la colonne gauche de la barre du haut du
client, qui est un `div` vide depuis toujours et qui, depuis le chantier A, est
la barre de titre de la fenêtre. Le client la dessinerait avec ses jetons, le
shell l'alimenterait par le pont.

**Le shell sans cadre**, et **la synchronisation automatique des jetons avec le
client**. Les deux sont des raffinements que la copie figée ne bloque pas.
