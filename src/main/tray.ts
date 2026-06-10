import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';
import { isNotificationsMuted, setNotificationsMuted } from './notifications';
import { getVoiceState, requestVoiceToggle } from './voice-bridge';
import { openServerWindow, showMainWindow } from './windows/main-window';
import { openServersManager } from './windows/servers-window';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;
let tray: Tray | null = null;

const trayDir = app.isPackaged
  ? join(process.resourcesPath, 'tray')
  : join(import.meta.dirname, '../../build/tray');

const iconFor = (state: 'normal' | 'notif-muted' | 'mic-muted') =>
  nativeImage.createFromPath(join(trayDir, `${state}.png`));

export const refreshTray = (store: Store) => {
  if (!tray) return;
  const voice = getVoiceState();
  const state = voice.inVoice && voice.muted ? 'mic-muted' : isNotificationsMuted() ? 'notif-muted' : 'normal';
  tray.setImage(iconFor(state));

  const active = store.getActive();
  const menu = Menu.buildFromTemplate([
    { label: active ? `Bullshark — ${active.label || active.url}` : 'Bullshark', enabled: false },
    { type: 'separator' },
    { label: 'Notifications', type: 'checkbox', checked: !isNotificationsMuted(),
      click: () => {
        const next = !isNotificationsMuted();
        setNotificationsMuted(next);
        store.setPrefs({ notificationsMuted: next });
        refreshTray(store);
      } },
    { label: 'Microphone', type: 'checkbox', checked: voice.inVoice && !voice.muted, enabled: voice.inVoice,
      click: () => requestVoiceToggle() },
    { type: 'separator' },
    { label: 'Servers', submenu: [
      ...store.list().map((s) => ({
        label: s.label || s.url, type: 'radio' as const, checked: s.id === active?.id,
        click: () => {
          store.switchTo(s.id);
          const next = store.getActive();
          if (next) openServerWindow(next);
          refreshTray(store);
        }
      })),
      { type: 'separator' as const },
      { label: 'Manage servers…', click: () => openServersManager() }
    ] },
    { type: 'separator' },
    { label: 'Show Bullshark', click: () => showMainWindow() },
    { label: 'Quit', click: () => { (global as { isQuitting?: boolean }).isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
};

export const initTray = (store: Store) => {
  tray = new Tray(iconFor('normal'));
  tray.setToolTip('Bullshark');
  tray.on('click', () => showMainWindow());
  refreshTray(store);
};
