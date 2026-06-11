import { describe, expect, test } from 'vitest';
import { resolveLocale, SUPPORTED_LOCALES } from './locales';

describe('resolveLocale', () => {
  test('normalizes a region variant to its base language', () => {
    expect(resolveLocale('fr-FR')).toBe('fr');
  });
  test('is case-insensitive', () => {
    expect(resolveLocale('FR')).toBe('fr');
  });
  test('handles multi-part tags', () => {
    expect(resolveLocale('zh-Hans-CN')).toBe('zh');
  });
  test('falls back to en for unsupported languages', () => {
    expect(resolveLocale('pt-BR')).toBe('en');
  });
  test('falls back to en for empty or missing input', () => {
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });
  test('supports exactly the 7 server locales', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['cs', 'en', 'es', 'fr', 'it', 'ru', 'zh']);
  });
});
