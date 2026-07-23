import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

/**
 * /rss.xml — Latest publications feed.
 *
 * Astro 5.x RSS endpoint. We surface the 20 most recent publications as
 * the feed payload; that keeps the feed compact while reflecting normal
 * researcher output. JA titles are exposed verbatim; the `description`
 * field carries the English title (if available) and venue, which is
 * what most feed readers display.
 */
export async function GET(context: APIContext) {
  const all = await getCollection('papers');
  const items = all
    .map((c) => c.data)
    .filter((p) => p.year > 0)
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return (b.monthNum ?? 0) - (a.monthNum ?? 0);
    })
    .slice(0, 20);

  return rss({
    title: 'Masahiro Sadamura — 貞村真宏',
    description:
      'Recent publications and conference presentations by Masahiro Sadamura (legal psychology, sentencing decisions, welfare-oriented support).',
    site: context.site?.toString() ?? 'https://sadamura.jp/',
    items: items.map((p) => {
      const mm = String(p.monthNum ?? 1).padStart(2, '0');
      const dd = String(Math.min(31, Math.max(1, Number.parseInt(p.day ?? '1', 10) || 1))).padStart(2, '0');
      let isoDate = new Date(`${p.year}-${mm}-${dd}T00:00:00+09:00`);
      if (Number.isNaN(isoDate.getTime())) isoDate = new Date(`${p.year}-01-01T00:00:00+09:00`);
      const venuePart = p.venue
        ? p.language === 'ja' && p.venueEn
          ? `${p.venue} (${p.venueEn})`
          : p.venue
        : '';
      const descParts = [p.titleEn, venuePart].filter(Boolean);
      // Unique, stable guid per item. Items without a DOI previously all
      // shared guid=…/publications, so readers folded them into one entry and
      // never surfaced new work. DOI when present, else a per-citekey anchor.
      const guid = p.doi ? `https://doi.org/${p.doi}` : `https://sadamura.jp/publications#${p.key}`;
      const categories = [...p.topics, p.pubtype];
      return {
        title: p.title,
        pubDate: isoDate,
        description: descParts.join(' — '),
        link: guid,
        categories,
        author: 'Masahiro Sadamura',
        // Override @astrojs/rss's default guid (which is link with
        // isPermaLink="true") to mark these ids as non-permalinks.
        customData: `<guid isPermaLink="false">${guid}</guid>`
      };
    }),
    customData: '<language>ja</language>',
    stylesheet: false,
    trailingSlash: false
  });
}
