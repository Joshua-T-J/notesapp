// Fails the build/test run on patterns that weaken the app's XSS defences, and checks that the
// CSP hash in vercel.json matches the inline theme script in src/index.html.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const RULES = [
  { re: /\[innerHTML\]|\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/, why: 'raw HTML sink' },
  { re: /bypassSecurityTrust\w*/, why: 'Angular sanitizer bypass' },
  { re: /\beval\s*\(|new\s+Function\s*\(/, why: 'dynamic code evaluation' },
  { re: /\bsrcdoc\b/, why: 'srcdoc' },
  { re: /document\.write\s*\(/, why: 'document.write' },
];
const INLINE_HANDLER = /<[^>]+\son[a-z]+\s*=\s*["']/i;
const HIDDEN_CHARS = /[‪-‮⁦-⁩‎‏؜﻿]/;

for (const file of walk(join(root, 'src'))) {
  if (!/\.(ts|html|scss|css)$/.test(file) || file.endsWith('.spec.ts')) continue;
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  text.split('\n').forEach((line, i) => {
    for (const { re, why } of RULES) if (re.test(line)) problems.push(`${rel}:${i + 1} ${why}`);
    if (file.endsWith('.html') && INLINE_HANDLER.test(line))
      problems.push(`${rel}:${i + 1} inline event handler attribute`);
    if (HIDDEN_CHARS.test(line))
      problems.push(`${rel}:${i + 1} hidden or bidirectional Unicode character`);
  });
}

// The pre-paint theme script is the only inline script; the CSP allows it by hash.
const index = readFileSync(join(root, 'src/index.html'), 'utf8');
const scripts = [...index.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');
for (const body of scripts) {
  const hash = `sha256-${createHash('sha256').update(body).digest('base64')}`;
  if (!vercel.includes(`'${hash}'`))
    problems.push(`vercel.json CSP is missing the inline script hash '${hash}'`);
}

if (problems.length) {
  console.error(`check:security found ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('check:security passed');
