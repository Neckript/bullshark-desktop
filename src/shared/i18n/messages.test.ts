import { describe, expect, test } from 'vitest';
import { ERROR_CODES, MESSAGES, t } from './messages';
import { SUPPORTED_LOCALES } from './locales';

describe('messages catalogue', () => {
  test('every error code has a non-empty entry in all 7 locales', () => {
    for (const code of ERROR_CODES) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(MESSAGES[code][locale]?.length, `${code}/${locale}`).toBeGreaterThan(0);
      }
    }
  });
  test('t returns the localized string for a known code', () => {
    expect(t('http-not-allowed', 'fr')).toBe(MESSAGES['http-not-allowed'].fr);
    expect(t('cert-untrusted', 'ru')).toBe(MESSAGES['cert-untrusted'].ru);
  });
  test('t falls back to the unreachable message for an unknown code', () => {
    expect(t('totally-unknown', 'en')).toBe(MESSAGES.unreachable.en);
  });
  test('compat banner codes exist and are localized', () => {
    expect(ERROR_CODES).toContain('server-too-old');
    expect(ERROR_CODES).toContain('server-native-unavailable');
    expect(t('server-too-old', 'fr')).toBe(MESSAGES['server-too-old'].fr);
    expect(t('server-native-unavailable', 'cs')).toBe(MESSAGES['server-native-unavailable'].cs);
  });
});
