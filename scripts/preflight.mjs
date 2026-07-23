#!/usr/bin/env node
/**
 * preflight.mjs — local sanity check before push.
 *
 * Verifies that the basics still line up:
 *   - papers.bib exists and has ≥30 @entries
 *   - bib2json produces a non-empty papers.json
 *   - astro check passes
 *   - astro build succeeds (writes ./dist)
 *
 * Run via: npm run preflight  (add the script in package.json if you like)
 *          OR: node scripts/preflight.mjs
 *
 * Exits non-zero on the first failure so it can also gate `git push`
 * via a Husky `pre-push` hook.
 */

import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
// papers.bib build source lives inside the repo (data/) so CI can read it.
// 04_コンテンツ原稿/_共通/papers.bib is a downstream mirror, not the build input.
const bibPath = path.resolve(root, 'data/papers.bib');
const jsonPath = path.resolve(root, 'src/data/papers.json');

const C = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m' };
let failed = 0;

async function step(label, fn) {
  process.stdout.write(`${C.dim}…${C.reset} ${label} `);
  try {
    const detail = await fn();
    console.log(`\r${C.green}✓${C.reset} ${label}${detail ? `  ${C.dim}${detail}${C.reset}` : ''}`);
  } catch (err) {
    failed++;
    console.log(`\r${C.red}✗${C.reset} ${label}`);
    console.log(`  ${C.red}${err.message ?? err}${C.reset}`);
  }
}

await step('papers.bib exists and has ≥30 entries', async () => {
  const text = await readFile(bibPath, 'utf8');
  const count = (text.match(/^@\w+\{/gm) ?? []).length;
  if (count < 30) throw new Error(`only ${count} entries (expected ≥30)`);
  return `${count} entries`;
});

await step('bib2json regenerates papers.json', async () => {
  await exec(process.execPath, [path.resolve(root, 'scripts/bib2json.mjs')], { cwd: root });
  const s = await stat(jsonPath);
  const arr = JSON.parse(await readFile(jsonPath, 'utf8'));
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('papers.json is empty');
  return `${arr.length} entries / ${(s.size / 1024).toFixed(1)} KB`;
});

await step('astro check (type-check)', async () => {
  await exec('npx', ['--no-install', 'astro', 'check'], { cwd: root, shell: true });
  return null;
});

await step('astro build (static output)', async () => {
  const { stdout } = await exec('npx', ['--no-install', 'astro', 'build'], { cwd: root, shell: true });
  // Astro logs "Build complete" or similar; we just trust the exit code.
  const pages = (stdout.match(/\bpages\b/gi) ?? []).length;
  return pages ? 'dist/ written' : 'build succeeded';
});

console.log('');
if (failed > 0) {
  console.log(`${C.red}preflight failed (${failed} step${failed === 1 ? '' : 's'}).${C.reset}`);
  process.exit(1);
}
console.log(`${C.green}preflight passed.${C.reset}`);
