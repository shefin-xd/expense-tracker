#!/usr/bin/env node
// Lists source files committed in your repository that are NOT part of this project, so you can remove them.
//   node scripts/find-stale-files.mjs            show stale files and the git command to remove them
//   node scripts/find-stale-files.mjs --update   regenerate scripts/source-manifest.txt from the current tree
// Works on Windows, macOS and Linux. Run it from the repository root.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'source-manifest.txt');
const roots = ['client/src', 'server/src'];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', cwd: join(here, '..') }).split('\n').map((l) => l.trim()).filter(Boolean);

if (process.argv.includes('--update')) {
  writeFileSync(manifestPath, git('ls-files', ...roots).sort().join('\n') + '\n');
  console.log(`Wrote ${manifestPath}`);
  process.exit(0);
}
if (!existsSync(manifestPath)) { console.error('Missing scripts/source-manifest.txt'); process.exit(2); }

const expected = new Set(readFileSync(manifestPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));
const tracked = git('ls-files', ...roots);
const stale = tracked.filter((f) => !expected.has(f));
const missing = [...expected].filter((f) => !tracked.includes(f));

if (!stale.length && !missing.length) { console.log('OK: the repository contains exactly the files of this project under client/src and server/src.'); process.exit(0); }
if (stale.length) {
  console.log(`Stale files (not part of this project), ${stale.length}:\n  ${stale.join('\n  ')}\n\nRemove them with:\n  git rm ${stale.map((f) => JSON.stringify(f)).join(' ')}`);
}
if (missing.length) console.log(`\nFiles from this project that are missing from your repository, ${missing.length}:\n  ${missing.join('\n  ')}`);
process.exit(1);
