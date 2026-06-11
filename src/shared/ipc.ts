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
  appLocale: 'app:locale'
} as const;

export const BRIDGE = {
  setMuted: 'bridge:set-muted',              // main → remote (DND state)
  voiceToggleRequest: 'bridge:voice-toggle', // main → remote (toggle mic)
  voiceState: 'bridge:voice-state',          // remote → main ({ inVoice, muted })
  focusWindow: 'bridge:focus-window'         // remote → main (show/focus the window)
} as const;
