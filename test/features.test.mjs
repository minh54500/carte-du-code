import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/analyze.mjs';
import { generate } from '../src/generate.mjs';
import { index } from '../src/query.mjs';
import { handle } from '../src/mcp.mjs';
import { i18n } from '../src/i18n.mjs';
import { renderMarkdown } from '../src/render-md.mjs';
import { DEFAULTS } from '../src/config.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const map = (name) => analyze(join(FIX, name), { ...DEFAULTS }, i18n('fr').t);
const node = (m, id) => m.nodes.find((n) => n.id === id);
const linked = (m, from, to, type) => m.edges.some((e) => e.from === from && e.to === to && (!type || e.type === type));
const copy = (name) => { const dir = mkdtempSync(join(tmpdir(), 'carte-')); cpSync(join(FIX, name), dir, { recursive: true }); return dir; };

test('monorepo: workspace packages resolve by name, routes carry the app name, stacks found inside apps', () => {
  const m = map('monorepo');
  for (const k of ['monorepo', 'Next.js', 'Drizzle']) assert.ok(m.kinds.includes(k), k);
  assert.equal(node(m, 'apps/web/app/shop/page.tsx').label, 'web /shop');
  assert.ok(linked(m, 'apps/web/app/page.tsx', 'packages/ui/src/index.ts'), '@acme/ui → its main file');
  assert.ok(linked(m, 'apps/web/app/page.tsx', 'apps/web/app/layout.tsx', 'wrapped by'));
  assert.ok(linked(m, 'apps/web/app/page.tsx', 'table:users', 'reads/writes'), 'Drizzle table used through its variable');
  assert.ok(linked(m, 'apps/web/app/page.tsx', 'packages/ui/src/index.ts'), 'nested "exports" conditions do not crash, the source entry is found');
  assert.ok(linked(m, 'apps/web/app/shop/page.tsx', 'packages/ui/src/Button.tsx'), '@acme/ui/Button through "exports": { "./*": "./src/*.tsx" }');
  assert.ok(linked(m, 'apps/blog/src/routes/+page.svelte', 'apps/blog/src/lib/posts.ts'), '$lib/ inside a SvelteKit workspace');
});

test('Django, SvelteKit and Nuxt: routes, implicit layouts and load files, models and collections', () => {
  const dj = map('django');
  assert.ok(dj.kinds.includes('Django'));
  assert.ok(linked(dj, 'route:DJ /shop/menu/', 'shop/views.py', 'calls'), "include('shop.urls') prefixes the routes");
  assert.ok(node(dj, 'route:DJ /shop/'));
  assert.ok(linked(dj, 'shop/views.py', 'model:Dish'));
  assert.deepEqual(index(dj).health().unused.map((n) => n.id), [], 'admin.py, apps.py and migrations are loaded by Django');

  const sk = map('sveltekit');
  assert.ok(linked(sk, 'src/routes/+page.svelte', 'src/routes/+page.server.ts', 'loads'));
  assert.ok(linked(sk, 'src/routes/blog/+page.svelte', 'src/routes/+layout.svelte', 'wrapped by'));
  assert.equal(node(sk, 'src/routes/api/hello/+server.ts').label, '/api/hello');
  assert.ok(linked(sk, 'src/lib/db.ts', 'collection:orders'), 'Firestore collection');

  const nx = map('nuxt');
  assert.ok(linked(nx, 'pages/index.vue', 'layouts/default.vue', 'wrapped by'));
  assert.ok(linked(nx, 'pages/shop.vue', 'layouts/shop.vue', 'wrapped by'), 'definePageMeta layout');
  assert.equal(node(nx, 'server/api/orders.get.ts').label, '/api/orders');
  assert.ok(linked(nx, 'server/api/orders.get.ts', 'model:Order'), 'Mongoose model');
  assert.ok(linked(nx, 'pages/index.vue', 'utils/fmt.ts'), '~/ is the Nuxt app folder');
  assert.ok(!node(nx, 'collection:legacy'), 'a MongoDB collection is not taken for Firestore');
  assert.ok(!index(nx).health().unused.some((n) => n.id === 'components/Card.vue'), 'Nuxt components are auto-imported');
});

test('real-world files: accented names, Windows line endings, a call to "/" is not a link', () => {
  assert.equal(node(map('astro-supabase'), 'src/pages/mentions-légales.astro').label, '/mentions-légales');
  const dir = copy('express-prisma');
  writeFileSync(join(dir, 'src/cart.js'), '// The cart drawer.\r\n// Opens from the right.\r\nexport const parts = (p) => p.split(\'/\');\r\n');
  writeFileSync(join(dir, 'src/home.js'), "// Home route.\napp.get('/', (req, res) => res.send('ok'));\n");
  const m = analyze(dir, { ...DEFAULTS }, i18n('fr').t);
  assert.equal(node(m, 'src/cart.js').desc, 'The cart drawer. Opens from the right.');
  assert.ok(!linked(m, 'src/cart.js', 'route:GET /', 'calls'));
});

test('questions: who uses, what it uses, the path along dependencies, search', () => {
  const q = index(map('astro-supabase'));
  assert.ok(q.usedBy('src/data/menu.ts').some((n) => n.id === 'src/components/Header.astro'));
  assert.ok(q.uses('src/data/generated.json').some((n) => n.id === 'scripts/sync.mjs'), 'generated data depends on the script that writes it');
  assert.ok(!q.usedBy('src/data/generated.json').some((n) => n.id === 'scripts/sync.mjs'), 'direct and deep answers agree');
  const deep = q.usedBy('table:dishes', true).map((n) => n.id);
  assert.ok(deep.includes('src/pages/index.astro'), 'the page depends on the table through the generated data');
  const p = q.path('src/pages/index.astro', 'table:dishes').map((n) => n.id);
  assert.deepEqual([p[0], p.at(-1)], ['src/pages/index.astro', 'table:dishes']);
  assert.ok(p.includes('scripts/sync.mjs'), 'the chain goes through the script that writes the data');
  assert.equal(q.find('Header').id, 'src/components/Header.astro');
  assert.ok(q.search('menu').length > 0);
});

test('health: unused files, import cycles, sensitive files', () => {
  const h = index(map('monorepo')).health();
  assert.deepEqual(h.unused.map((n) => n.id), ['packages/ui/src/orphan.ts']);
  assert.deepEqual(h.cycles.map((c) => c.map((n) => n.id).sort()), [['packages/ui/src/a.ts', 'packages/ui/src/b.ts']]);
  assert.deepEqual(h.sensitive.slice(0, 2).map((x) => x.n.id).sort(), ['packages/ui/src/Button.tsx', 'packages/ui/src/a.ts']);
});

test('a second run lists what changed; a big project gets a condensed map and a detail file', () => {
  const dir = copy('astro-supabase'), out = join(dir, 'docs/carte');
  generate(dir, { ...DEFAULTS, out });
  const hues = JSON.parse(readFileSync(join(out, 'carte-du-code.json'), 'utf8')).hues;
  writeFileSync(join(dir, 'src/components/Footer.astro'), '---\n// The footer.\n---\n<footer />\n');
  const { changes, paths } = generate(dir, { ...DEFAULTS, out, condenseAbove: 3 });
  assert.deepEqual(changes.added, ['src/components/Footer.astro']);
  const md = readFileSync(paths.md, 'utf8');
  assert.match(md, /Changements depuis la carte précédente/);
  assert.match(md, /Projet volumineux/);
  assert.ok(existsSync(join(out, 'carte-du-code-detail.md')));
  const json = JSON.parse(readFileSync(paths.json, 'utf8'));
  assert.ok(Array.isArray(json.health.unused) && json.changes.added.length === 1);
  for (const [f, h] of Object.entries(hues)) assert.equal(json.hues[f], h, `${f} keeps its colour`);
  assert.match(readFileSync(paths.html, 'utf8'), /"health":/);
});

test('MCP: handshake, tool list, answers, errors as tool results', () => {
  const init = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(init.result.protocolVersion, '2025-03-26');
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const names = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.map((t) => t.name);
  assert.deepEqual(names, ['overview', 'search', 'item', 'who_uses', 'uses', 'path', 'health']);
  const ask = (name, args) => handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: { project: join(FIX, 'astro-supabase'), ...args } } }).result;
  assert.match(ask('who_uses', { item: 'table:dishes' }).content[0].text, /sync/);
  assert.match(ask('path', { from: 'src/pages/index.astro', to: 'table:dishes' }).content[0].text, /→ dishes/);
  assert.match(ask('overview', {}).content[0].text, /Astro/);
  assert.equal(ask('item', { item: 'nothing-like-this' }).isError, true);
  assert.match(ask('item', { item: join(FIX, 'astro-supabase', 'src/data/menu.ts') }).content[0].text, /^menu /, 'absolute path');
  assert.match(ask('item', { item: 'src\\data\\menu.ts' }).content[0].text, /^menu /, 'Windows path');
  assert.equal(handle({ jsonrpc: '2.0', id: 4, method: 'nope' }).error.code, -32601);
  assert.equal(handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } }).error.code, -32602);
  assert.equal(handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'path', arguments: { from: 'a' } } }).error.code, -32602);
  assert.equal(handle(null).error.code, -32600);
  assert.equal(handle({ jsonrpc: '2.0', id: 7, method: 'initialize', params: null }).result.serverInfo.name, 'carte-du-code');
  const batch = handle([{ jsonrpc: '2.0', id: 8, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]);
  assert.deepEqual(batch, [{ jsonrpc: '2.0', id: 8, result: {} }]);
});

test('MCP over stdio: one JSON message per line in, one per line out, survives bad lines', () => {
  const bin = fileURLToPath(new URL('../bin/carte.mjs', import.meta.url));
  const input = ['null', ...[{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'health', arguments: {} } }].map((m) => JSON.stringify(m))].join('\n') + '\n';
  const lines = execFileSync('node', [bin, 'mcp', join(FIX, 'monorepo')], { input, encoding: 'utf8' }).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 3, 'a bad line gets an error and the server goes on');
  assert.match(lines[2].result.content[0].text, /orphan/);
});

test('Supabase: what each SQL function reads and writes, the functions it calls, triggers and policies', () => {
  const m = map('astro-supabase');
  assert.ok(linked(m, 'rpc:visit', 'table:visits', 'reads/writes'));
  assert.ok(linked(m, 'rpc:visit', 'table:customers', 'reads/writes'));
  assert.ok(linked(m, 'rpc:visit', 'rpc:norm', 'calls'));
  assert.ok(linked(m, 'table:visits', 'rpc:touch', 'triggers'));
  assert.ok(linked(m, 'table:dishes', 'rpc:is_editor', 'calls'), 'a policy written in a format() loop checks the function');
  assert.equal(node(m, 'rpc:norm').desc, 'fonction', '"security definer" of the next function is not read as this one’s');
  assert.equal(node(m, 'rpc:visit').desc, 'fonction security definer');
  assert.ok(!node(m, 'table:public'), 'quoted names as supabase db diff writes them: "public"."orders"');
  assert.match(node(m, 'table:orders').desc, /RLS activé · lecture : authenticated/);
  assert.ok(linked(m, 'rpc:order_count', 'table:orders'));
  assert.equal(node(m, 'rpc:order_count').desc, 'fonction security definer', 'set later by alter function');
  const p = index(m).path('src/pages/admin.astro', 'table:customers').map((n) => n.id);
  assert.deepEqual(p, ['src/pages/admin.astro', 'src/scripts/admin.ts', 'rpc:visit', 'table:customers'], 'page → script → function → table');
});

test('Swift: types named in the code (not in comments or texts), extensions, no import cycles', () => {
  const m = map('swift-app');
  assert.ok(linked(m, 'Store.swift', 'StoreActions.swift', 'extended by'), 'extension Store is part of Store');
  assert.ok(linked(m, 'ContentView.swift', 'Store.swift'));
  assert.ok(!linked(m, 'ContentView.swift', 'Theme.swift'), 'Theme only appears in a comment and a text');
  assert.equal(node(m, 'StoreActions.swift').desc, 'The actions on the shelf: keep a file, empty the shelf.', '/// under the imports');
  const h = index(m).health();
  assert.deepEqual(h.unused.map((n) => n.id), ['Theme.swift']);
  assert.deepEqual(h.cycles, [], 'types that name each other are not an import cycle');
  assert.deepEqual([h.sensitive[0].n.id, h.sensitive[0].count, h.sensitive[0].direct], ['Store.swift', 3, 3]);
  assert.deepEqual(index(m).usedBy('StoreActions.swift', true).map((n) => n.id).sort(), ['App.swift', 'ContentView.swift', 'Store.swift'], 'whoever uses Store uses its extension');
  assert.equal(node(m, 'Theme.swift').desc, '', '#if and // MARK: are not a role');
  assert.deepEqual(h.undescribed.top.map((x) => x.n.id), ['Store.swift']);
});

test('names: files with the same name get their folder, and a question on a shared name lists the candidates', () => {
  const m = map('astro-supabase');
  assert.equal(node(m, 'src/data/ui.ts').label, 'data/ui');
  assert.equal(node(m, 'src/scripts/admin/ui.ts').label, 'admin/ui');
  assert.equal(node(m, 'src/components/Header.astro').label, 'Header', 'a unique name stays short');
  const q = index(m);
  assert.deepEqual(q.matches('ui').map((n) => n.id).sort(), ['src/data/ui.ts', 'src/scripts/admin/ui.ts']);
  assert.equal(q.find('admin/ui').id, 'src/scripts/admin/ui.ts');
  assert.deepEqual(q.matches('data/menu').map((n) => n.id), ['src/data/menu.ts'], 'a path without its extension');
  const ex = index(map('express-prisma')), dj = index(map('django'));
  assert.deepEqual(ex.matches('server.js').map((n) => n.id), ['src/server.js'], 'the file, not the routes it declares');
  assert.deepEqual(dj.matches('models.py').map((n) => n.id), ['shop/models.py'], 'the file, not its models');
  const w = handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'who_uses', arguments: { project: join(FIX, 'express-prisma'), item: 'server.js' } } }).result;
  assert.ok(!w.isError, 'who_uses "server.js" answers as in 1.1.1');
  assert.match(w.content[0].text, /npm run start/);
  const r = handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'item', arguments: { project: join(FIX, 'astro-supabase'), item: 'ui' } } }).result;
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /matches 2 items[\s\S]*src\/data\/ui\.ts[\s\S]*src\/scripts\/admin\/ui\.ts/);
});

test('roles under the imports, command-line scripts, drafts, the files to describe first', () => {
  const m = map('astro-supabase');
  assert.equal(node(m, 'src/data/ui.ts').desc, 'Which card design the menu uses (a comment under the import).');
  assert.equal(node(m, 'src/scripts/admin/ui.ts').desc, 'Small helpers of the admin screen (a comment under a multi-line import).');
  assert.equal(node(m, 'docs/brouillons/legal.ts').col, 'doc');
  const h = index(m).health();
  assert.ok(!h.unused.some((n) => n.id === 'docs/brouillons/legal.ts'));
  assert.equal(h.undescribed.top[0].n.id, 'src/layouts/Base.astro');
  const ex = map('express-prisma');
  assert.equal(node(ex, 'src/seed.js').col, 'tool', 'reads its command line and nobody imports it');
  assert.equal(node(ex, 'src/seed.js').desc, 'Fills the database with sample users: node src/seed.js <count>');
  assert.equal(node(ex, 'src/db.js').col, 'bloc');
  const md = renderMarkdown(m, i18n('fr').t, { date: '', htmlPath: '', health: h });
  assert.match(md, /## Documents et brouillons \(1\)/);
  assert.match(md, /À décrire en priorité \(\d+ fichiers sans commentaire en tête\) : les plus utilisés : `src\/layouts\/Base\.astro`/);
});

test('a role is the comment that introduces the code, not one inside it; same name in the same folder keeps its extension', () => {
  const dir = copy('astro-supabase');
  writeFileSync(join(dir, 'src/pages/lieu.astro'), "---\nimport Base from '../layouts/Base.astro';\n// The week from Monday.\nconst names = ['lun', 'mar'];\n---\n<Base />\n");
  writeFileSync(join(dir, 'src/consts.py'), 'import os\n\n# constants\nLIMIT = 3\n');
  writeFileSync(join(dir, 'src/server.js'), "const http = require('http');\nconst server = http.createServer((req, res) => {\n  // answers every request\n  res.end('ok');\n});\n");
  writeFileSync(join(dir, 'src/components/Card.astro'), '---\n// A card.\n---\n<div />\n');
  writeFileSync(join(dir, 'src/components/Card.tsx'), '// A card, in React.\nexport default () => null;\n');
  const m = analyze(dir, { ...DEFAULTS }, i18n('fr').t);
  for (const f of ['src/pages/lieu.astro', 'src/consts.py', 'src/server.js']) assert.equal(node(m, f).desc, '', f);
  assert.deepEqual([node(m, 'src/components/Card.astro').label, node(m, 'src/components/Card.tsx').label], ['Card.astro', 'Card.tsx']);
});
