export type ServerEntry = { id: string; label: string; url: string; lastUsedAt: number };

export const DEFAULT_MUTE_HOTKEY = 'CommandOrControl+Shift+M';
export const DEFAULT_OVERLAY_HOTKEY = 'CommandOrControl+Shift+O';

export const OVERLAY_CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const;
export type OverlayCorner = (typeof OVERLAY_CORNERS)[number];

export type Prefs = {
  activeServerId: string | null;
  notificationsMuted: boolean;
  launchOnStartup: boolean;
  lastWindowBounds: { width: number; height: number; x?: number; y?: number } | null;
  muteHotkey: string; // Electron accelerator; '' = hotkey disabled
  overlayEnabled: boolean;
  overlayHotkey: string; // Electron accelerator; '' = hotkey disabled
  overlayCorner: OverlayCorner;
};

export const DEFAULT_PREFS: Prefs = {
  activeServerId: null,
  notificationsMuted: false,
  launchOnStartup: false,
  lastWindowBounds: null,
  muteHotkey: DEFAULT_MUTE_HOTKEY,
  overlayEnabled: false,
  overlayHotkey: DEFAULT_OVERLAY_HOTKEY,
  overlayCorner: 'top-right'
};

export type OverlayParticipant = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  speaking: boolean;
  micMuted: boolean;
};

export type OverlayPayload = {
  inVoice: boolean;
  participants: OverlayParticipant[];
};

export type VoiceState = { inVoice: boolean; muted: boolean };

export type CompatBannerPayload = {
  verdict: 'too-old' | 'native-unavailable';
  message: string;
};

export type UpdateBannerPayload = {
  message: string;
  reloadLabel: string;
};

export type SourceDto = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl?: string;
};
