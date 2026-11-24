// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The sitemap's <lastmod> repeats the "Last updated" date the built page shows
// (src/lib/page-dates.ts), so the two never disagree; a page that shows no date
// gets no <lastmod>. It used to be the build time for every URL.
const distDir = new URL('./dist/', import.meta.url);
/** @param {string} pageUrl */
function shownLastUpdated(pageUrl) {
  try {
    const { pathname } = new URL(pageUrl);
    const file = new URL(`.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`, distDir);
    const html = readFileSync(file, 'utf8');
    return html.match(/<time datetime="(\d{4}-\d{2}-\d{2})">[^<]*<\/time><\/small>\s*<\/p>\s*<\/main>/)?.[1];
  } catch {
    return undefined;
  }
}

// https://astro.build/config
export default defineConfig({
  site: 'https://sadamura.jp',
  output: 'static',
  // `ignore` (the default) accepts `/en` and `/en/` interchangeably. The
  // strict `never` setting confuses Astro's preview server and some hosts
  // for routes that resolve to a directory's index.html. We let canonical
  // URLs (set per page in SEO.astro) handle dedup signaling instead.
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto'
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport'
  },
  i18n: {
    locales: ['ja', 'en', 'zh'],
    defaultLocale: 'ja',
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },
  integrations: [
    mdx(),
    sitemap({
      // 404 is a soft error page, never a canonical destination — keep it out
      // of the sitemap.
      filter: (page) => !page.includes('/404'),
      i18n: {
        defaultLocale: 'ja',
        locales: {
          ja: 'ja-JP',
          en: 'en',
          zh: 'zh-CN'
        }
      },
      changefreq: 'monthly',
      priority: 0.7,
      serialize(item) {
        const lastmod = shownLastUpdated(item.url);
        if (lastmod) item.lastmod = lastmod;
        else delete item.lastmod;
        return item;
      }
    })
  ],
  vite: {
    build: {
      cssCodeSplit: true
    }
  }
});
