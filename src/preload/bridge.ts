import { contextBridge, ipcRenderer } from 'electron';
import { BRIDGE } from '../shared/ipc';
import type { VoiceState } from '../shared/types';

let muted = false;
ipcRenderer.on(BRIDGE.setMuted, (_e, value: boolean) => { muted = value; });

// NOTE: we deliberately do NOT override window.Notification here. Under
// contextIsolation the preload's globals are isolated from the page, so an
// override would have no effect. DND is enforced by the web app companion
// change consulting notifications.isMuted() before calling new Notification().
contextBridge.exposeInMainWorld('bullshark', {
  isDesktop: true,
  notifications: { isMuted: () => muted },
  voice: {
    reportState: (state: VoiceState) => ipcRenderer.send(BRIDGE.voiceState, state),
    onToggleRequest: (cb: () => void) => {
      const h = () => cb();
      ipcRenderer.on(BRIDGE.voiceToggleRequest, h);
      return () => ipcRenderer.removeListener(BRIDGE.voiceToggleRequest, h);
    }
  },
  focusWindow: () => ipcRenderer.send(BRIDGE.focusWindow),
  onMuteChanged: (cb: (muted: boolean) => void) => {
    const h = (_e: unknown, v: boolean) => cb(v);
    ipcRenderer.on(BRIDGE.setMuted, h);
    return () => ipcRenderer.removeListener(BRIDGE.setMuted, h);
  }
});
