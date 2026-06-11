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
