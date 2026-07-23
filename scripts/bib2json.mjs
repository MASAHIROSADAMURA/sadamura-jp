#!/usr/bin/env node
/**
 * bib2json.mjs — Convert papers.bib into src/data/papers.json.
 *
 * Reads:  data/papers.bib (in-repo build canonical; mirrored from
 *         04_コンテンツ原稿/_共通/papers.bib)
 * Writes: src/data/papers.json (consumed by Astro Content Layer)
 *
 * The parser handles the BibTeX subset we actually emit in papers.bib:
 *   @type{key, field = {value}, ... }
 *   - Brace-balanced values
 *   - `%` line comments
 *   - `field-en` aliases for Japanese/English title pairs
 *   - a small LaTeX subset (accents, \& \_ , -- , stray braces)
 *
 * Run via `npm run bib` (auto-invoked by `npm run dev` and `npm run build`).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const bibPath = path.resolve(projectRoot, 'data/papers.bib');
const outPath = path.resolve(projectRoot, 'src/data/papers.json');

const pubtypeOrder = { article: 0, conference: 1, other: 2, book: 3 };

// Fine-grained bib topic slugs → coarse display categories (10 buckets).
// Every coarse key here MUST have a `pub.topic.<key>` entry in src/i18n/{ja,en}.json,
// otherwise the filter button renders the raw key. Unmapped slugs fall back to
// `other` (with a build-time warning) so a new tag never leaks a raw key.
const TOPIC_MAP = {
  // 量刑判断 / Sentencing
  sentencing: 'sentencing',
  'judicial-decisions': 'sentencing',
  'juvenile-sentencing': 'sentencing',
  punitiveness: 'sentencing',
  'free-will': 'sentencing',
  blame: 'sentencing',
  'gender-roles': 'sentencing',
  gender: 'sentencing',
  'caregiver-abandonment': 'sentencing',
  'rape-shield-law': 'sentencing',
  'victim-history': 'sentencing',
  'mediation-analysis': 'sentencing',
  // 実名報道・少年 / Real-name reporting & juveniles
  'real-name-reporting': 'realname',
  juvenile: 'realname',
  schadenfreude: 'realname',
  acceptance: 'realname',
  'responsibility-attribution': 'realname',
  attribution: 'realname',
  individualization: 'realname',
  // 児童虐待 / Child maltreatment
  'child-abuse': 'childabuse',
  'child-maltreatment': 'childabuse',
  maltreatment: 'childabuse',
  'child-welfare-services': 'childabuse',
  decoding: 'childabuse',
  reporting: 'childabuse',
  'reporting-intention': 'childabuse',
  recognition: 'childabuse',
  // 性的同意・性犯罪 / Sexual consent & offenses
  'sexual-consent': 'sexconsent',
  'sex-crimes': 'sexconsent',
  'gender-differences': 'sexconsent',
  'cross-cultural': 'sexconsent',
  'japan-canada': 'sexconsent',
  'scenario-development': 'sexconsent',
  'scale-development': 'sexconsent',
  exploratory: 'sexconsent',
  // 動物虐待 / Animal cruelty
  'animal-abuse': 'animal',
  // 死刑 / Death penalty
  'death-penalty': 'deathpenalty',
  'fear-of-crime': 'deathpenalty',
  'victimization-risk': 'deathpenalty',
  // 障害 / Disability
  disability: 'disability',
  asperger: 'disability',
  // 福祉的支援 / Welfare-oriented support
  'welfare-support': 'welfare',
  // NLP / ML
  NLP: 'nlp-ml',
  'emotion-references': 'nlp-ml',
  // ピアサポート / Peer support
  'peer-support': 'peer',
  'university-mental-health': 'peer',
  // その他 / Other（市民意識・司法参加など）
  'public-perception': 'other',
  'criminal-justice': 'other',
  'lay-participation': 'other'
};

// English month name → 1-12 (used for RSS pubDate and chronological sort).
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

// Composed characters for the LaTeX accent commands we actually use.
const ACCENTS = {
  '"a': 'ä', '"o': 'ö', '"u': 'ü', '"A': 'Ä', '"O': 'Ö', '"U': 'Ü', '"e': 'ë', '"i': 'ï',
  "'a": 'á', "'e": 'é', "'i": 'í', "'o": 'ó', "'u": 'ú', "'A": 'Á', "'E": 'É', "'n": 'ń', "'c": 'ć',
  '`a': 'à', '`e': 'è', '`i': 'ì', '`o': 'ò', '`u': 'ù',
  '^a': 'â', '^e': 'ê', '^i': 'î', '^o': 'ô', '^u': 'û',
  '~n': 'ñ', '~a': 'ã', '~o': 'õ', '~N': 'Ñ',
  '=a': 'ā', '=e': 'ē', '=i': 'ī', '=o': 'ō', '=u': 'ū'
};

const text = await readFile(bibPath, 'utf8');
const entries = parseBibtex(text);
const items = entries.map(toItem).sort(sortDesc);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(items, null, 2) + '\n', 'utf8');
console.log(`✓ bib2json: ${items.length} entries → ${path.relative(projectRoot, outPath)}`);

// ---------- BibTeX parser ----------

function parseBibtex(src) {
  // Drop whole-line `%` comments (incl. indented ones inside an entry)
  const cleaned = src.replace(/^\s*%.*$/gm, '');
  const entries = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const type = m[1].toLowerCase();
    const key = m[2];
    const bodyStart = re.lastIndex;
    const bodyEnd = findEntryEnd(cleaned, bodyStart);
    if (bodyEnd === -1) break;
    const body = cleaned.slice(bodyStart, bodyEnd);
    entries.push({ type, key, fields: parseFields(body) });
    re.lastIndex = bodyEnd + 1;
  }
  return entries;
}

function findEntryEnd(src, start) {
  let depth = 1; // we are already inside `@type{`
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseFields(body) {
  const fields = {};
  let i = 0;
  const n = body.length;
  while (i < n) {
    // skip whitespace + commas
    while (i < n && /[\s,]/.test(body[i])) i++;
    if (i >= n) break;
    // field name
    const nameMatch = body.slice(i).match(/^([\w-]+)\s*=\s*/);
    if (!nameMatch) break;
    const name = nameMatch[1].toLowerCase();
    i += nameMatch[0].length;
    // field value
    let value = '';
    if (body[i] === '{') {
      let depth = 0;
      do {
        if (body[i] === '{') depth++;
        else if (body[i] === '}') depth--;
        value += body[i];
        i++;
      } while (i < n && depth > 0);
      value = value.slice(1, -1); // strip outer braces
    } else if (body[i] === '"') {
      i++;
      while (i < n && body[i] !== '"') {
        value += body[i];
        i++;
      }
      i++;
    } else {
      // bare value (numbers, etc.)
      while (i < n && !/[\s,]/.test(body[i])) {
        value += body[i];
        i++;
      }
    }
    fields[name] = stripOuterBraces(value).trim();
  }
  return fields;
}

function stripOuterBraces(s) {
  // {{title}} → title  (used for Japanese titles)
  let out = s.trim();
  while (out.startsWith('{') && out.endsWith('}')) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

// ---------- LaTeX decoding ----------

/**
 * Decode the small LaTeX subset that appears in the bib into Unicode, so
 * titles/venues/authors render cleanly (e.g. `Anthrozo{\"o}s` → `Anthrozoös`,
 * `Taylor \& Francis` → `Taylor & Francis`). Applied to human-facing text
 * fields only (title, venue, publisher, author, editor) — NOT to `pages`.
 */
function decodeLatex(s) {
  if (!s) return s;
  let out = s;
  // Accent commands in any of: \"o  \"{o}  {\"o}  {\"{o}}
  out = out.replace(/\{?\\(["'`^~=.])\{?([A-Za-z])\}?\}?/g, (whole, accent, letter) => {
    return ACCENTS[accent + letter] ?? letter;
  });
  // Escaped punctuation
  out = out
    .replace(/\\&/g, '&')
    .replace(/\\_/g, '_')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/\\\$/g, '$');
  // Dashes: em (---) before en (--)
  out = out.replace(/---/g, '—').replace(/--/g, '–');
  // Strip any remaining stray braces
  out = out.replace(/[{}]/g, '');
  // Collapse whitespace
  return out.replace(/\s+/g, ' ').trim();
}

// ---------- Transform ----------

function splitAuthors(authorField) {
  return authorField
    .split(/\s+and\s+/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

function isSelf(name) {
  const lower = name.toLowerCase();
  return lower.includes('sadamura, masahiro') || name.includes('貞村');
}

function monthToNum(m) {
  if (!m) return null;
  const key = m.trim().toLowerCase();
  if (MONTHS[key]) return MONTHS[key];
  const n = Number.parseInt(key, 10);
  return n >= 1 && n <= 12 ? n : null;
}

function coarseTopics(fine) {
  const out = [];
  for (const t of fine) {
    let c = TOPIC_MAP[t];
    if (!c) {
      console.warn(`⚠ bib2json: unmapped topic "${t}" → other (add it to TOPIC_MAP)`);
      c = 'other';
    }
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

function toItem(e) {
  const f = e.fields;
  const pubtype =
    f.pubtype ??
    (e.type === 'inproceedings' ? 'conference' : e.type === 'book' ? 'book' : 'article');

  // language: {japanese} → ja, {english} → en (prefix, case-insensitive)
  const langRaw = (f.language ?? '').trim().toLowerCase();
  const language = langRaw.startsWith('ja') ? 'ja' : langRaw.startsWith('en') ? 'en' : 'en';

  const authors = (f.author ? splitAuthors(f.author) : []).map((raw) => {
    const name = decodeLatex(raw);
    return { name, isSelf: isSelf(name) };
  });

  // authorrole = {first-author} / {sole-author}  (sole implies first)
  const authorrole = (f.authorrole ?? '').trim().toLowerCase();
  const firstAuthor =
    authorrole === 'first-author' || authorrole === 'sole-author' || f.firstauthor === 'yes';
  const soloAuthor = authorrole === 'sole-author' || f.soloauthor === 'yes';

  const fineTopics = (f.topic ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const topics = coarseTopics(fineTopics);

  return {
    id: e.key,
    key: e.key,
    type: e.type,
    pubtype,
    language,
    title: decodeLatex(f.title ?? ''),
    titleEn: f['title-en'] ? decodeLatex(f['title-en']) : null,
    authors,
    editor: f.editor ? decodeLatex(f.editor) : null,
    role: f.role ? f.role.trim() : null,
    year: Number.parseInt(f.year ?? '', 10) || 0,
    yearText: /^\s*\d{4}\s*$/.test(f.year ?? '') ? null : f.year ? f.year.trim() : null,
    month: f.month ?? null,
    monthNum: monthToNum(f.month),
    day: f.day ?? null,
    venue: decodeLatex(f.journal ?? f.booktitle ?? f.publisher ?? ''),
    venueEn: f['journal-en'] || f['booktitle-en'] ? decodeLatex(f['journal-en'] ?? f['booktitle-en']) : null,
    volume: f.volume ?? null,
    number: f.number ?? null,
    pages: f.pages ?? null,
    doi: f.doi ?? null,
    url: f.url ?? null,
    note: f.note ? decodeLatex(f.note) : null,
    publisher: f.publisher ? decodeLatex(f.publisher) : null,
    topics,
    firstAuthor,
    soloAuthor
  };
}

function sortDesc(a, b) {
  if (b.year !== a.year) return b.year - a.year;
  const am = a.monthNum ?? 0;
  const bm = b.monthNum ?? 0;
  if (bm !== am) return bm - am;
  return (pubtypeOrder[a.pubtype] ?? 9) - (pubtypeOrder[b.pubtype] ?? 9);
}
