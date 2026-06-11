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
  screenSources: 'screen:sources',
  screenPick: 'screen:pick',
  screenCancel: 'screen:cancel'
} as const;
