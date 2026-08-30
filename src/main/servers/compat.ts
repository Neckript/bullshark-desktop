import { compareVersions } from './version';

// Single source of truth for compatibility thresholds.
// Bump MIN_SERVER_VERSION when a real client/server API break appears.
// Set MIN_SERVER_VERSION_NATIVE_FEATURES to the server version where the
// window.bullshark companion change ships; until then the layer is dormant.
export const MIN_SERVER_VERSION = '0.0.0';
export const MIN_SERVER_VERSION_NATIVE_FEATURES: string | null = null;

export type CompatVerdict = 'ok' | 'too-old' | 'native-unavailable' | 'unknown';

export const evaluateCompat = (
  version: string | null,
  minVersion: string = MIN_SERVER_VERSION,
  minNative: string | null = MIN_SERVER_VERSION_NATIVE_FEATURES
): CompatVerdict => {
  if (version === null) return 'unknown';
  if (compareVersions(version, minVersion) < 0) return 'too-old';
  if (minNative !== null && compareVersions(version, minNative) < 0) return 'native-unavailable';
  return 'ok';
};

// Version du serveur à partir de laquelle la page fournit une zone de
// glissement (-webkit-app-region), donc à partir de laquelle la fenêtre peut
// s'ouvrir sans cadre. VOLONTAIREMENT à l'écart d'evaluateCompat : ce verdict
// alimente la bannière de compatibilité, et un serveur plus ancien ne doit pas
// voir d'avertissement pour un changement purement cosmétique.
export const MIN_SERVER_VERSION_FRAMELESS: string | null = '0.0.29';

export const supportsFramelessWindow = (version: string | null): boolean =>
  version !== null &&
  MIN_SERVER_VERSION_FRAMELESS !== null &&
  compareVersions(version, MIN_SERVER_VERSION_FRAMELESS) >= 0;
