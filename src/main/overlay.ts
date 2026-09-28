import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { BRIDGE } from '../shared/bridge';
import type { OverlayCorner, OverlayPayload } from '../shared/types';
import type { createServerStore } from './servers/store';

type Store = ReturnType<typeof createServerStore>;

const OVERLAY_WIDTH = 240;
const OVERLAY_HEIGHT = 420;
const OVERLAY_MARGIN = 16;

let store: Store | null = null;
let overlay: BrowserWindow | null = null;
// Toggled by the global hotkey; independent of the persisted enable switch.
let manuallyHidden = false;
let lastPayload: OverlayPayload = { inVoice: false, participants: [] };

const isEnabled = () => store?.getPrefs().overlayEnabled ?? false;

export const initOverlay = (s: Store) => {
  store = s;
};

const computeBounds = (corner: OverlayCorner) => {
  const { workArea } = screen.getPrimaryDisplay();
  const top = corner.startsWith('top');
  const left = corner.endsWith('left');

  return {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: left
      ? workArea.x + OVERLAY_MARGIN
      : workArea.x + workArea.width - OVERLAY_WIDTH - OVERLAY_MARGIN,
    y: top
      ? workArea.y + OVERLAY_MARGIN
      : workArea.y + workArea.height - OVERLAY_HEIGHT - OVERLAY_MARGIN
  };
};

const createOverlayWindow = () => {
  const corner = store?.getPrefs().overlayCorner ?? 'top-right';

  overlay = new BrowserWindow({
    ...computeBounds(corner),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, '../preload/shell.cjs')
    }
  });

  // Sit above fullscreen-borderless games and follow the user across spaces.
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-through: pointer events pass to whatever is underneath.
  overlay.setIgnoreMouseEvents(true, { forward: true });

  overlay.on('closed', () => {
    overlay = null;
  });

  // Push the latest roster as soon as the page is ready.
  overlay.webContents.on('did-finish-load', () => {
    overlay?.webContents.send(IPC.overlayParticipants, lastPayload);
  });

  const base = process.env.ELECTRON_RENDERER_URL;
  if (base) void overlay.loadURL(`${base}#/overlay`);
  else
    void overlay.loadFile(join(import.meta.dirname, '../renderer/index.html'), {
      hash: '/overlay'
    });
};

const destroyOverlayWindow = () => {
  if (overlay && !overlay.isDestroyed()) overlay.destroy();
  overlay = null;
};

const showIfAppropriate = () => {
  if (!overlay || overlay.isDestroyed()) return;
  if (manuallyHidden) {
    overlay.hide();
  } else {
    overlay.showInactive();
  }
};

// Relays a roster update from the remote page. Owns the overlay window's
// lifecycle: present while enabled and in a voice channel, gone otherwise.
export const applyOverlayParticipants = (payload: OverlayPayload) => {
  lastPayload = payload;

  if (!isEnabled() || !payload.inVoice) {
    destroyOverlayWindow();
    return;
  }

  if (!overlay) createOverlayWindow();
  overlay?.webContents.send(IPC.overlayParticipants, payload);
  showIfAppropriate();
};

// Sends the enable flag to a window's remote page so its reporter can start or
// stop the audio analysis. Called on the server window's load and on changes.
export const sendOverlayEnabledTo = (win: BrowserWindow) => {
  win.webContents.send(BRIDGE.overlayEnabled, isEnabled());
};

const broadcastOverlayEnabled = () => {
  BrowserWindow.getAllWindows().forEach((w) =>
    w.webContents.send(BRIDGE.overlayEnabled, isEnabled())
  );
};

// Called after the overlayEnabled pref changes.
export const refreshOverlayEnabled = () => {
  broadcastOverlayEnabled();
  if (!isEnabled()) destroyOverlayWindow();
};

// Called after the overlayCorner pref changes.
export const repositionOverlay = () => {
  if (!overlay || overlay.isDestroyed()) return;
  const corner = store?.getPrefs().overlayCorner ?? 'top-right';
  overlay.setBounds(computeBounds(corner));
};

// Bound to the global overlay hotkey: hide/show without touching the pref.
export const toggleOverlayVisibility = () => {
  manuallyHidden = !manuallyHidden;
  showIfAppropriate();
};
