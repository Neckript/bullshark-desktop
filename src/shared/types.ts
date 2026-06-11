export type ServerEntry = { id: string; label: string; url: string; lastUsedAt: number };

export type Prefs = {
  activeServerId: string | null;
  notificationsMuted: boolean;
  launchOnStartup: boolean;
  lastWindowBounds: { width: number; height: number; x?: number; y?: number } | null;
};

export const DEFAULT_PREFS: Prefs = {
  activeServerId: null,
  notificationsMuted: false,
  launchOnStartup: false,
  lastWindowBounds: null
};

export type VoiceState = { inVoice: boolean; muted: boolean };

export type CompatBannerPayload = {
  verdict: 'too-old' | 'native-unavailable';
  message: string;
};
