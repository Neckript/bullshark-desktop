export type ServerEntry = { id: string; label: string; url: string; lastUsedAt: number };

export const DEFAULT_MUTE_HOTKEY = 'CommandOrControl+Shift+M';

export type Prefs = {
  activeServerId: string | null;
  notificationsMuted: boolean;
  launchOnStartup: boolean;
  lastWindowBounds: { width: number; height: number; x?: number; y?: number } | null;
  muteHotkey: string; // Electron accelerator; '' = hotkey disabled
};

export const DEFAULT_PREFS: Prefs = {
  activeServerId: null,
  notificationsMuted: false,
  launchOnStartup: false,
  lastWindowBounds: null,
  muteHotkey: DEFAULT_MUTE_HOTKEY
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
