import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';
import { isNotificationsMuted, setNotificationsMuted } from './notifications';
import { getVoiceState, requestVoiceToggle } from './voice-bridge';
import { openServerWindow, showMainWindow } from './windows/main-window';
import { openSettingsWindow } from './windows/servers-window';
import { buildTrayTemplate } from './tray-menu';
import { resolveLocale } from '../shared/i18n/locales';
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
  const menu = Menu.buildFromTemplate(
    buildTrayTemplate({
      // Meme resolution que le canal `app:locale` du renderer, pour que le menu
      // et les fenetres ne parlent jamais deux langues differentes.
      locale: resolveLocale(app.getLocale()),
      servers: store.list(),
      activeId: active?.id ?? null,
      voice,
      notificationsMuted: isNotificationsMuted(),
      actions: {
        toggleNotifications: () => {
          const next = !isNotificationsMuted();
          setNotificationsMuted(next);
          store.setPrefs({ notificationsMuted: next });
          refreshTray(store);
        },
        toggleMicrophone: () => requestVoiceToggle(),
        switchServer: (id) => {
          store.switchTo(id);
          const next = store.getActive();
          if (next) void openServerWindow(next);
          refreshTray(store);
        },
        openSettings: () => openSettingsWindow(),
        showApp: () => showMainWindow(),
        quit: () => {
          (global as { isQuitting?: boolean }).isQuitting = true;
          app.quit();
        }
      }
    })
  );
  tray.setContextMenu(menu);
};

export const initTray = (store: Store) => {
  tray = new Tray(iconFor('normal'));
  tray.setToolTip('Bullshark');
  tray.on('click', () => showMainWindow());
  refreshTray(store);
};
