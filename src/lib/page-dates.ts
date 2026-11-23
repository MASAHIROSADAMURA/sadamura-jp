/**
 * The date shown as "Last updated" at the foot of each page (BaseLayout.astro).
 * The sitemap's <lastmod> is read back from the built pages, so the two always
 * agree (astro.config.mjs).
 *
 * - The verification records under /lab/ state on the page that they are not
 *   edited after publication. They keep the date they showed on the day they
 *   were published (PUBLISHED below); their own files are left as they are.
 * - Every other page shows the date its content last changed: the newest
 *   commit date (JST) of its file under src/pages/ and of the data it is built
 *   from (`@data/…` imports, and the file a content collection is generated
 *   from). Commits whose message carries the trailer `Last-Updated: unchanged`
 *   (technical edits that leave what a page says as it was) are skipped.
 * - When that date cannot be known (no git, a shallow clone, a file that is not
 *   committed yet) the page shows no date rather than a wrong one. CI checks
 *   out the full history for this reason.
 * - A page that passes `lastUpdated` itself (the /zh/guide articles) keeps its
 *   own value.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The value each record showed on its publication day. Keys end with `/`. */
const PUBLISHED: Readonly<Record<string, string>> = {
  '/lab/r8-tanto/': '2026-07-24',
  '/en/lab/r8-tanto/': '2026-07-24',
  '/lab/r8-tanto-kekka/': '2026-08-07',
  '/en/lab/r8-tanto-kekka/': '2026-08-07'
};

/** Content collections and the committed file each one is generated from. */
const COLLECTION_SOURCES: Readonly<Record<string, string>> = {
  papers: 'data/papers.bib'
};

const UNCHANGED_TRAILER = /^Last-Updated:\s*unchanged\s*$/im;

const root = process.cwd();
const jstDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

let commitDates: Map<string, string> | null | undefined;

/** Newest commit date (JST) of every committed path; null when history is unavailable. */
function loadCommitDates(): Map<string, string> | null {
  if (commitDates !== undefined) return commitDates;
  commitDates = null;
  try {
    const git = (args: string[]) =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore']
      });
    // A shallow clone holds only the latest commit(s), so every file would
    // look as if it had changed on that day.
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return commitDates;
    const log = git([
      'log',
      '--format=%x1e%cI%x1f%B%x1f',
      '--name-only',
      '--relative',
      '--',
      'src/pages',
      'src/data',
      'data'
    ]);
    const dates = new Map<string, string>();
    for (const record of log.split('\x1e').slice(1)) {
      const [committed, message = '', files = ''] = record.split('\x1f');
      if (UNCHANGED_TRAILER.test(message)) continue;
      const day = jstDate.format(new Date(committed));
      for (const line of files.split('\n')) {
        const file = line.trim();
        if (file && !dates.has(file)) dates.set(file, day);
      }
    }
    commitDates = dates;
  } catch {
    // git is not available or this is not a repository: show no date.
  }
  return commitDates;
}

/** The file under src/pages/ that renders `pathname`. */
function pageSource(pathname: string): string | null {
  const route = pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/index';
  for (const file of [`src/pages${route}.astro`, `src/pages${route}/index.astro`]) {
    if (existsSync(join(root, file))) return file;
  }
  return null;
}

/** Committed data files a page is built from; null when one cannot be resolved. */
function dataSources(page: string): string[] | null {
  const source = readFileSync(join(root, page), 'utf8');
  const files: string[] = [];
  for (const [, spec] of source.matchAll(/from\s+['"]@data\/([^'"]+)['"]/g)) {
    const base = `src/data/${spec}`;
    const file = [base, `${base}.ts`, `${base}.js`, `${base}.json`].find((f) => existsSync(join(root, f)));
    if (!file) return null;
    files.push(file);
  }
  for (const [, name] of source.matchAll(/getCollection\(\s*['"]([^'"]+)['"]/g)) {
    const file = COLLECTION_SOURCES[name];
    if (!file) return null;
    files.push(file);
  }
  return files;
}

/** "Last updated" for `pathname` as YYYY-MM-DD, or undefined when it cannot be known. */
export function pageLastUpdated(pathname: string): string | undefined {
  const published = PUBLISHED[pathname.endsWith('/') ? pathname : `${pathname}/`];
  if (published) return published;
  const dates = loadCommitDates();
  const page = pageSource(pathname);
  const data = page ? dataSources(page) : null;
  if (!dates || !page || !data) return undefined;
  let newest: string | undefined;
  for (const file of [page, ...data]) {
    const day = dates.get(file);
    if (!day) return undefined;
    if (!newest || day > newest) newest = day;
  }
  return newest;
}
