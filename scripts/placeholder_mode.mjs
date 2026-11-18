// Temporary placeholder mode.
// Runs after `astro build` and replaces everything in dist/ with a single placeholder page
// (index.html and 404.html), so every URL on the site shows the placeholder.
// To restore the full site, revert the commit that added this script to the build.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

const page = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>準備中 | Temporarily unavailable</title>
<style>
  html { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafafa; color: #333; font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; }
  main { padding: 2rem; text-align: center; line-height: 1.9; }
  p { margin: 0; }
  .en { color: #666; font-size: 0.95em; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181b; color: #ddd; }
    .en { color: #9a9a9a; }
  }
</style>
</head>
<body>
<main>
<p lang="ja">ただいま準備中です。</p>
<p lang="en" class="en">This site is temporarily unavailable.</p>
</main>
</body>
</html>
`;

let cname = null;
try {
  cname = await readFile(join(dist, 'CNAME'), 'utf8');
} catch {
  // No CNAME in the build output; nothing to carry over.
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(join(dist, 'index.html'), page, 'utf8');
await writeFile(join(dist, '404.html'), page, 'utf8');
if (cname !== null) await writeFile(join(dist, 'CNAME'), cname, 'utf8');

console.log(`[placeholder] dist now contains: ${(await readdir(dist)).join(', ')}`);
