import ja from './ja.json';
import en from './en.json';

export type Lang = 'ja' | 'en';
export const defaultLang: Lang = 'ja';
export const supportedLangs: readonly Lang[] = ['ja', 'en'] as const;

const dictionaries: Record<Lang, Record<string, string>> = { ja, en };

/**
 * Derive the active locale from a URL. Routes prefixed with `/en` resolve
 * to `'en'`; everything else (including bare root) falls back to `'ja'`.
 */
export function getLangFromUrl(url: URL): Lang {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') return 'en';
  return 'ja';
}

/**
 * Return a translator bound to `lang`. Missing keys fall back to the key
 * string itself so the UI never shows `undefined`.
 */
export function useTranslations(lang: Lang) {
  const dict = dictionaries[lang];
  return (key: string): string => dict[key] ?? key;
}

/**
 * Build a locale-aware route. JA stays at the root (`/foo`), EN gets the
 * `/en` prefix (`/en/foo`). The root path `/` is preserved verbatim.
 */
export function localizedPath(lang: Lang, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'ja') return normalized;
  if (normalized === '/') return '/en/';
  return `/en${normalized}`;
}

/**
 * Map the current pathname to its counterpart in `targetLang`. Used by
 * the language switcher so the user lands on the equivalent page rather
 * than the home of the other locale.
 */
export function switchLangPath(currentPath: string, targetLang: Lang): string {
  const stripped = currentPath.replace(/^\/en(?:\/|$)/, '/') || '/';
  return localizedPath(targetLang, stripped);
}
