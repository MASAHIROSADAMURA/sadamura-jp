import ja from './ja.json';
import en from './en.json';
import zh from './zh.json';

export type Lang = 'ja' | 'en' | 'zh';
export const defaultLang: Lang = 'ja';
export const supportedLangs: readonly Lang[] = ['ja', 'en', 'zh'] as const;

/**
 * BCP 47 tags used for `<html lang>`, `hreflang`, and the sitemap i18n map.
 * `zh` is Simplified Chinese for mainland readers, hence `zh-CN`.
 */
export const langTag: Record<Lang, string> = {
  ja: 'ja',
  en: 'en',
  zh: 'zh-CN'
};

/** Open Graph locale codes. */
export const ogLocale: Record<Lang, string> = {
  ja: 'ja_JP',
  en: 'en_US',
  zh: 'zh_CN'
};

const dictionaries: Record<Lang, Record<string, string>> = { ja, en, zh };

/**
 * Which locales each page actually ships in. Used for hreflang emission and
 * by the language switcher so we never link to a page that does not exist.
 * Keys are locale-stripped paths without a trailing slash (`/` for home).
 * Unlisted paths (e.g. `/404`) fall back to `['ja', 'en']`.
 */
export const routeLocales: Record<string, readonly Lang[]> = {
  '/': ['ja', 'en', 'zh'],
  '/profile': ['ja', 'en', 'zh'],
  '/publications': ['ja', 'en'],
  '/resources': ['ja', 'en'],
  '/contact': ['ja', 'en', 'zh'],
  '/about': ['ja', 'en'],
  // EN 版は 2026-07-31 に追加。ja / en / zh の 3 言語で相互 hreflang を張る。
  '/services': ['ja', 'en', 'zh'],
  '/legal': ['ja'],
  // 中文の個人情報告知（2026-08-04）。ja / en 版は無く、日本語の /legal・/about が
  // 対応する内容を持つため、zh 単独ルートとして登録する。
  '/privacy': ['zh'],
  '/lab/r8-tanto': ['ja', 'en'],
  // 中文記事ハブ（2026-07-31）。ja / en 版は無いので zh 単独ルートとして登録し、
  // hreflang も言語切替も存在しない言語へのリンクを出さない。
  '/guide': ['zh'],
  '/guide/japan-graduate-admissions-routes': ['zh'],
  '/guide/research-proposal-guide': ['zh'],
  '/guide/ai-research-proposal': ['zh'],
  '/guide/japan-boarding-junior-high-schools': ['zh'],
  '/guide/baolu-shibie-zhinan': ['zh']
};

const fallbackLocales: readonly Lang[] = ['ja', 'en'];

/**
 * Derive the active locale from a URL. Routes prefixed with `/en` or `/zh`
 * resolve to that locale; everything else (including bare root) falls back
 * to `'ja'`.
 */
export function getLangFromUrl(url: URL): Lang {
  const segments = url.pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first === 'en' || first === 'zh') return first;
  return defaultLang;
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
 * Build a locale-aware route. JA stays at the root (`/foo`), the other
 * locales get their prefix (`/en/foo`, `/zh/foo`). The root path `/` is
 * preserved verbatim for JA and becomes `/en/` · `/zh/` otherwise.
 */
export function localizedPath(lang: Lang, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (lang === defaultLang) return normalized;
  if (normalized === '/') return `/${lang}/`;
  return `/${lang}${normalized}`;
}

/**
 * Drop the locale prefix from a pathname, preserving its trailing-slash
 * style so canonical and alternate URLs stay consistent.
 */
export function stripLangPrefix(pathname: string): string {
  return pathname.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
}

/** Normalise a pathname for comparison / lookup (no trailing slash, `/` for root). */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Locales in which the given (possibly prefixed) path is published. */
export function localesForPath(pathname: string): readonly Lang[] {
  const base = normalizePath(stripLangPrefix(pathname));
  return routeLocales[base] ?? fallbackLocales;
}

/**
 * Map the current pathname to its counterpart in `targetLang`. Used by
 * the language switcher so the user lands on the equivalent page rather
 * than the home of the other locale — unless the page has no counterpart
 * in that locale, in which case we send them to that locale's home
 * instead of a 404.
 */
export function switchLangPath(currentPath: string, targetLang: Lang): string {
  if (!localesForPath(currentPath).includes(targetLang)) {
    return localizedPath(targetLang, '/');
  }
  return localizedPath(targetLang, stripLangPrefix(currentPath));
}
