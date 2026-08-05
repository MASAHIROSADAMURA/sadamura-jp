// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

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
      lastmod: new Date()
    })
  ],
  vite: {
    build: {
      cssCodeSplit: true
    }
  }
});
