export const IPC = {
  serversList: 'servers:list',
  serversAdd: 'servers:add',
  serversUpdate: 'servers:update',
  serversRemove: 'servers:remove',
  serversSwitch: 'servers:switch',
  serversValidate: 'servers:validate',
  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',
  serversChanged: 'servers:changed',
  appLocale: 'app:locale',
  appVersion: 'app:version',
  appRepository: 'app:repository',
  screenSources: 'screen:sources',
  screenPick: 'screen:pick',
  screenCancel: 'screen:cancel'
} as const;

// Cibles acceptees par le canal `app:repository`. Liste FERMEE : le renderer
// choisit dans cet ensemble, il ne transmet jamais d'URL. Voir src/main/ipc.ts.
export const REPOSITORY_TARGETS = ['codeberg', 'github'] as const;
export type RepositoryTarget = (typeof REPOSITORY_TARGETS)[number];
