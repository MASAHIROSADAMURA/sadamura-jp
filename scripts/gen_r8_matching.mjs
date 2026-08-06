#!/usr/bin/env node
/**
 * gen_r8_matching.mjs — Build the 113-slot matching table for /lab/r8-tanto-kekka.
 *
 * Reads:  public/lab/derivation_r8.json      (pre-registered derivation, SHA-256 pinned)
 *         data/r8_official_answers.json      (official answers, MD5-pinned source PDFs)
 * Writes: src/data/r8_matching.json          (consumed by src/pages/lab/r8-tanto-kekka.astro)
 *
 * The matching table is never hand-written: every row is the machine join of the
 * published derivation JSON (whose SHA-256 is inscribed on the pre-registration
 * page) and the official answer key. The script refuses to emit anything if the
 * derivation file's hash drifts or if the resulting tallies disagree with the
 * figures stated in the page text.
 *
 * Run via `npm run r8:match` (regeneration only — the output is committed so
 * `astro check` and CI need no extra step).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const derivationPath = path.resolve(projectRoot, 'public/lab/derivation_r8.json');
const officialPath = path.resolve(projectRoot, 'data/r8_official_answers.json');
const outPath = path.resolve(projectRoot, 'src/data/r8_matching.json');

/** SHA-256 inscribed on /lab/r8-tanto (published 2026-07-24, never edited). */
const DERIVATION_SHA256 =
  '69e025a4823ea3dcc11ca5093f7211c22380fb43fe0179dc6df2c324acb35b52';

/** Display order: matches the pre-registration page and the summary table. */
const SUBJECT_ORDER = ['憲法', '民法', '刑法'];

/**
 * Invariants asserted before writing. These are the figures stated in the page
 * text; if the data ever stops supporting them the build source must change,
 * not the prose.
 */
const EXPECTED = {
  total: 113,
  slotsBySubject: { 憲法: 40, 民法: 37, 刑法: 36 },
  matchesBySubject: { 憲法: 39, 民法: 37, 刑法: 36 },
  totalMatches: 112,
  byConfidence: { A: { slots: 99, matches: 98 }, B: { slots: 14, matches: 14 } },
  watch: { slots: 2, matches: 1 },
  corrected: { slots: 1, matches: 1 }
};

function fail(message) {
  console.error(`gen_r8_matching: ${message}`);
  process.exit(1);
}

/** `No.5` / `問12` → 5 / 12. The numeric part is the join key within a subject. */
function slotNumber(slot) {
  const m = String(slot).match(/(\d+)/);
  if (!m) fail(`unparsable slot label: ${slot}`);
  return Number(m[1]);
}

const derivationRaw = await readFile(derivationPath);
const actualSha = createHash('sha256').update(derivationRaw).digest('hex');
if (actualSha !== DERIVATION_SHA256) {
  fail(
    `derivation_r8.json SHA-256 mismatch.\n  expected ${DERIVATION_SHA256}\n  actual   ${actualSha}\n` +
      'The pre-registered dataset is immutable; refusing to generate.'
  );
}

const derivation = JSON.parse(derivationRaw.toString('utf8'));
const official = JSON.parse(await readFile(officialPath, 'utf8'));

if (derivation.length !== EXPECTED.total) {
  fail(`derivation has ${derivation.length} slots (expected ${EXPECTED.total})`);
}

const rows = derivation
  .map((d) => {
    const table = official.answers[d.subject];
    if (!table) fail(`no official answers for subject ${d.subject}`);
    const n = slotNumber(d.slot);
    const officialAnswer = table[String(n)];
    if (typeof officialAnswer !== 'number') {
      fail(`no official answer for ${d.subject} ${d.slot}`);
    }
    return {
      subject: d.subject,
      question: d.question,
      slot: d.slot,
      slotNo: n,
      derived: d.answer,
      official: officialAnswer,
      match: d.answer === officialAnswer,
      confidence: d.confidence,
      watch: d.watch === true,
      corrected: d.corrected === true
    };
  })
  .sort((a, b) => {
    const s = SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject);
    return s !== 0 ? s : a.slotNo - b.slotNo;
  });

// ---- verification ---------------------------------------------------------
const tally = (pred) => rows.filter(pred).length;
const problems = [];

for (const subject of SUBJECT_ORDER) {
  const slots = tally((r) => r.subject === subject);
  const matches = tally((r) => r.subject === subject && r.match);
  if (slots !== EXPECTED.slotsBySubject[subject]) {
    problems.push(`${subject}: ${slots} slots (expected ${EXPECTED.slotsBySubject[subject]})`);
  }
  if (matches !== EXPECTED.matchesBySubject[subject]) {
    problems.push(`${subject}: ${matches} matches (expected ${EXPECTED.matchesBySubject[subject]})`);
  }
}

const totalMatches = tally((r) => r.match);
if (totalMatches !== EXPECTED.totalMatches) {
  problems.push(`total matches ${totalMatches} (expected ${EXPECTED.totalMatches})`);
}

for (const grade of ['A', 'B']) {
  const slots = tally((r) => r.confidence === grade);
  const matches = tally((r) => r.confidence === grade && r.match);
  const want = EXPECTED.byConfidence[grade];
  if (slots !== want.slots) problems.push(`confidence ${grade}: ${slots} slots (expected ${want.slots})`);
  if (matches !== want.matches) problems.push(`confidence ${grade}: ${matches} matches (expected ${want.matches})`);
}

const watchSlots = tally((r) => r.watch);
const watchMatches = tally((r) => r.watch && r.match);
if (watchSlots !== EXPECTED.watch.slots) problems.push(`watch: ${watchSlots} slots (expected ${EXPECTED.watch.slots})`);
if (watchMatches !== EXPECTED.watch.matches) problems.push(`watch: ${watchMatches} matches (expected ${EXPECTED.watch.matches})`);

const correctedSlots = tally((r) => r.corrected);
const correctedMatches = tally((r) => r.corrected && r.match);
if (correctedSlots !== EXPECTED.corrected.slots) problems.push(`corrected: ${correctedSlots} slots (expected ${EXPECTED.corrected.slots})`);
if (correctedMatches !== EXPECTED.corrected.matches) problems.push(`corrected: ${correctedMatches} matches (expected ${EXPECTED.corrected.matches})`);

const seen = new Set();
for (const r of rows) {
  const key = `${r.subject}/${r.slotNo}`;
  if (seen.has(key)) problems.push(`duplicate slot ${key}`);
  seen.add(key);
}

if (problems.length > 0) {
  fail(`tally mismatch — refusing to write:\n  - ${problems.join('\n  - ')}`);
}

// ---- emit -----------------------------------------------------------------
const payload = {
  _note:
    'GENERATED FILE — do not edit by hand. Run `npm run r8:match` to regenerate from ' +
    'public/lab/derivation_r8.json × data/r8_official_answers.json.',
  derivationSha256: DERIVATION_SHA256,
  officialSource: official.source,
  summary: {
    total: rows.length,
    matches: totalMatches,
    bySubject: Object.fromEntries(
      SUBJECT_ORDER.map((s) => [
        s,
        {
          slots: tally((r) => r.subject === s),
          matches: tally((r) => r.subject === s && r.match)
        }
      ])
    ),
    byConfidence: Object.fromEntries(
      ['A', 'B'].map((g) => [
        g,
        { slots: tally((r) => r.confidence === g), matches: tally((r) => r.confidence === g && r.match) }
      ])
    ),
    watch: { slots: watchSlots, matches: watchMatches },
    corrected: { slots: correctedSlots, matches: correctedMatches }
  },
  rows
};

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(
  `gen_r8_matching: ${rows.length} slots → ${path.relative(projectRoot, outPath)} ` +
    `(${totalMatches} matched; 憲法 ${EXPECTED.matchesBySubject.憲法}/${EXPECTED.slotsBySubject.憲法}, ` +
    `民法 ${EXPECTED.matchesBySubject.民法}/${EXPECTED.slotsBySubject.民法}, ` +
    `刑法 ${EXPECTED.matchesBySubject.刑法}/${EXPECTED.slotsBySubject.刑法})`
);
