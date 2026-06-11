export const SUPPORTED_LOCALES = ['cs', 'en', 'es', 'fr', 'it', 'ru', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const resolveLocale = (raw: string | undefined | null): Locale => {
  const base = (raw ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en';
};
