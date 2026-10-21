import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/analyze.mjs';
import { generate } from '../src/generate.mjs';
import { installHook } from '../src/init.mjs';
import { i18n } from '../src/i18n.mjs';
import { DEFAULTS } from '../src/config.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const fr = i18n('fr').t;
const map = (name, t = fr) => analyze(join(FIX, name), { ...DEFAULTS }, t);
const node = (m, id) => m.nodes.find((n) => n.id === id);
const linked = (m, from, to, type) => m.edges.some((e) => e.from === from && e.to === to && (!type || e.type === type));

test('Astro + Supabase: pages, imports, aliases and generated data', () => {
  const m = map('astro-supabase');
  assert.deepEqual(m.kinds.slice(0, 2), ['Astro', 'Supabase']);
  assert.equal(node(m, 'src/pages/index.astro').label, '/');
  assert.equal(node(m, 'src/pages/menu/[cat].astro').label, '/menu/[cat]');
  assert.equal(node(m, 'src/pages/index.astro').desc, 'Home page: the menu of the day and the opening hours.');
  assert.ok(linked(m, 'src/pages/index.astro', 'src/components/Header.astro'));
  assert.ok(linked(m, 'src/components/Header.astro', 'src/data/menu.ts'), 'alias @/ resolved');
  assert.ok(linked(m, 'src/data/menu.ts', 'src/data/generated.json'));
  assert.ok(linked(m, 'scripts/sync.mjs', 'src/data/generated.json', 'writes'), 'new URL(..) path seen as written');
  assert.ok(linked(m, 'src/pages/admin.astro', 'src/scripts/admin.ts'), '<script src> followed');
});

test('Astro + Supabase: tables, RLS through a loop, functions, jobs, buckets', () => {
  const m = map('astro-supabase');
  const dishes = node(m, 'table:dishes');
  assert.match(dishes.desc, /RLS activé · lecture : anon, authenticated · écriture : éditeurs/);
  assert.equal(dishes.badge, 'modifié depuis l’admin');
  assert.match(node(m, 'table:secrets').desc, /lecture : personne/);
  assert.equal(node(m, 'rpc:is_editor').desc, 'fonction security definer');
  assert.ok(linked(m, 'scripts/sync.mjs', 'table:dishes'));
  assert.ok(linked(m, 'src/scripts/admin.ts', 'rpc:is_editor', 'calls'));
  assert.ok(node(m, 'bucket:photos'));
  assert.equal(node(m, 'job:nightly-reset').label, 'tâche nightly-reset : chaque jour à 03:00 UTC');
  assert.ok(linked(m, 'job:nightly-reset', 'rpc:is_editor'));
});

test('Astro + Supabase: server functions, crons, env names, hosting', () => {
  const m = map('astro-supabase');
  assert.equal(node(m, 'api/staff.ts').label, '/api/staff');
  assert.ok(linked(m, 'api/staff.ts', 'api/_db.ts'), "'./_db.js' resolves to the .ts file");
  assert.ok(linked(m, 'src/scripts/admin.ts', 'api/staff.ts', 'calls'));
  assert.ok(linked(m, 'cron:/api/staff', 'api/staff.ts', 'triggers'));
  assert.deepEqual([...m.env.keys()].sort(), ['STAFF_CODE', 'SUPABASE_SECRET_KEY']);
  assert.ok(m.host.some((h) => /en-têtes de sécurité \(1\)/.test(h)));
  assert.ok(linked(m, 'npm:build', 'scripts/sync.mjs', 'runs'));
});

test('Next.js: app router routes, route groups, route handlers, tsconfig paths with comments', () => {
  const m = map('next-app');
  assert.ok(m.kinds.includes('Next.js'));
  assert.equal(node(m, 'app/page.tsx').label, '/');
  assert.equal(node(m, 'app/blog/[slug]/page.tsx').label, '/blog/[slug]');
  assert.equal(node(m, 'app/blog/[slug]/page.tsx').desc, 'A blog post.', "'use client' skipped");
  assert.equal(node(m, 'app/(marketing)/about/page.tsx').label, '/about');
  assert.equal(node(m, 'app/api/hello/route.ts').col, 'server');
  assert.ok(linked(m, 'app/page.tsx', 'components/Hero.tsx'));
  assert.ok(linked(m, 'app/(marketing)/about/page.tsx', 'app/api/hello/route.ts', 'calls'));
});

test('Python + Flask: entry points, routes, imports, env, shell scripts', () => {
  const m = map('python-flask');
  assert.equal(node(m, 'app.py').col, 'page');
  assert.equal(node(m, 'app.py').desc, 'Web app: health check and orders.');
  assert.ok(node(m, 'route:ROUTE /health'));
  assert.ok(linked(m, 'route:GET /orders', 'app.py'));
  assert.ok(linked(m, 'app.py', 'services/db.py'));
  assert.ok(linked(m, 'deploy.sh', 'app.py', 'runs'));
  assert.deepEqual([...m.env.keys()].sort(), ['DATABASE_URL', 'DB_KEY']);
  assert.equal(m.web, false);
});

test('Express + Prisma: models, routes with params, calls from the browser', () => {
  const m = map('express-prisma');
  assert.ok(node(m, 'model:User') && node(m, 'model:Post'));
  assert.ok(linked(m, 'src/server.js', 'model:User'));
  assert.ok(linked(m, 'src/client.js', 'route:GET /users', 'calls'));
  assert.ok(linked(m, 'src/client.js', 'route:POST /posts/:id', 'calls'), 'route param matches a template string');
  assert.ok(linked(m, 'npm:start', 'src/server.js'));
});

test('English labels', () => {
  const m = map('astro-supabase', i18n('en').t);
  assert.match(node(m, 'table:dishes').desc, /RLS on · read : anon, authenticated · write : editors/);
  assert.equal(node(m, 'job:nightly-reset').label, 'job nightly-reset : every day at 03:00 UTC');
});

test('generate writes the map, the graph and the JSON, with code safely embedded', () => {
  const out = mkdtempSync(join(tmpdir(), 'carte-'));
  const { paths } = generate(join(FIX, 'express-prisma'), { ...DEFAULTS, out });
  for (const p of Object.values(paths)) assert.ok(existsSync(p), p);
  const html = readFileSync(paths.html, 'utf8');
  assert.ok(!html.includes('</script><script>alert(1)'), 'a code comment cannot break out of the page');
  const json = JSON.parse(readFileSync(paths.json, 'utf8'));
  assert.ok(json.nodes.length > 0 && json.edges.length > 0);
  assert.match(readFileSync(paths.md, 'utf8'), /^# Carte du code : api-demo/);
});

test('init installs the hook once, ignores the output folder and adds the CLAUDE.md section once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carte-git-'));
  cpSync(join(FIX, 'next-app'), dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, '.git/hooks/post-commit'), '#!/bin/sh\necho other-tool\n');
  for (let i = 0; i < 2; i++) installHook(dir, { ...DEFAULTS }, fr, { claude: true });
  const hook = readFileSync(join(dir, '.git/hooks/post-commit'), 'utf8');
  assert.equal(hook.match(/carte-du-code-start/g).length, 1);
  assert.ok(hook.includes('echo other-tool'), 'other hooks are kept');
  assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8').match(/^docs\/carte\/$/gm).length, 1);
  assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8').match(/<!-- carte-du-code -->/g).length, 1);
});

test('the CLI answers --help and --version, and fails cleanly on a wrong option', () => {
  const bin = fileURLToPath(new URL('../bin/carte.mjs', import.meta.url));
  assert.match(execFileSync('node', [bin, '--help'], { encoding: 'utf8' }), /carte live/);
  assert.match(execFileSync('node', [bin, '-v'], { encoding: 'utf8' }), /^\d+\.\d+\.\d+/);
  assert.throws(() => execFileSync('node', [bin, '--nope'], { stdio: 'pipe' }));
});
